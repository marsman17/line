import webpush from "web-push";
import { db } from "./db.ts";
export const pushConfigured = () =>
  Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
export const smsConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER,
  );
let running = false;
export async function deliverNotifications() {
  if (running) return;
  running = true;
  try {
    db.prepare(
      "UPDATE notifications SET status='pending' WHERE status='processing' AND next_attempt<?",
    ).run(Date.now());
    const jobs = db
      .prepare(
        "SELECT n.*, t.phone, t.name, t.status AS ticket_status, b.name AS branch_name FROM notifications n JOIN tickets t ON t.id=n.ticket_id JOIN branches b ON b.id=t.branch_id WHERE n.status='pending' AND n.next_attempt<=? AND n.attempts<5",
      )
      .all(Date.now()) as unknown as {
      id: number;
      ticket_id: string;
      channel: string;
      attempts: number;
      phone: string;
      name: string;
      ticket_status: string;
      branch_name: string;
    }[];
    for (const job of jobs) {
      if (job.ticket_status !== "notified") {
        db.prepare(
          "UPDATE notifications SET status='cancelled' WHERE id=?",
        ).run(job.id);
        continue;
      }
      try {
        const claim = db
          .prepare(
            "UPDATE notifications SET status='processing',next_attempt=? WHERE id=? AND status='pending'",
          )
          .run(Date.now() + 60000, job.id);
        if (!claim.changes) continue;
        if (job.channel === "push") {
          const sub = db
            .prepare("SELECT subscription FROM subscriptions WHERE ticket_id=?")
            .get(job.ticket_id) as { subscription: string } | undefined;
          if (!sub || !pushConfigured()) {
            db.prepare(
              "UPDATE notifications SET status='pending',next_attempt=? WHERE id=?",
            ).run(Date.now() + 15000, job.id);
            continue;
          }
          webpush.setVapidDetails(
            process.env.VAPID_SUBJECT!,
            process.env.VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!,
          );
          await webpush.sendNotification(
            JSON.parse(sub.subscription),
            JSON.stringify({
              title: "Your table is ready",
              body: `${job.name}, please return to the host at ${job.branch_name}.`,
              ticketId: job.ticket_id,
            }),
            { TTL: 300, timeout: 10000 },
          );
        } else {
          if (!smsConfigured()) {
            db.prepare(
              "UPDATE notifications SET status='pending',next_attempt=? WHERE id=?",
            ).run(Date.now() + 15000, job.id);
            continue;
          }
          const sid = process.env.TWILIO_ACCOUNT_SID!;
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: job.phone,
                From: process.env.TWILIO_FROM_NUMBER!,
                Body: `${job.name}, your table at ${job.branch_name} is ready. Please return to the host.`,
              }),
              signal: AbortSignal.timeout(10000),
            },
          );
          if (!response.ok)
            throw new Error(`SMS provider returned HTTP ${response.status}`);
        }
        db.prepare(
          "UPDATE notifications SET status='sent',sent_at=?,attempts=attempts+1,last_error=NULL WHERE id=?",
        ).run(new Date().toISOString(), job.id);
      } catch (error) {
        const gone =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          [404, 410].includes(Number(error.statusCode));
        if (gone)
          db.prepare("DELETE FROM subscriptions WHERE ticket_id=?").run(
            job.ticket_id,
          );
        db.prepare(
          "UPDATE notifications SET status=?,attempts=attempts+1,last_error=?,next_attempt=? WHERE id=?",
        ).run(
          gone || job.attempts >= 4 ? "failed" : "pending",
          gone
            ? "Push subscription expired"
            : "Delivery failed; check provider configuration",
          Date.now() + Math.min(300000, 15000 * 2 ** job.attempts),
          job.id,
        );
      }
    }
  } finally {
    running = false;
  }
}
