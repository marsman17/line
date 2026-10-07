import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import {
  db,
  tickets,
  join,
  findGuest,
  guestView,
  transition,
  rateLimit,
  health,
} from "../../../lib/db";
import { hash, passwordMatches, token } from "../../../lib/security";
import {
  deliverNotifications,
  pushConfigured,
  smsConfigured,
} from "../../../lib/notifications";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const guestSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine(
      (v) => !v || /^\+[1-9]\d{7,14}$/.test(v),
      "Use a phone number with country code, e.g. +15551234567.",
    ),
  email: z.union([z.email(), z.literal("")]).default(""),
  partySize: z.number().int().min(1).max(20),
  priority: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
  consent: z.boolean().optional(),
});
async function readBody(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError("Missing request body.");
  const decoder = new TextDecoder();
  let content = "";
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) {
      await reader.cancel();
      throw new Error("Request body is too large.");
    }
    content += decoder.decode(value, { stream: true });
  }
  content += decoder.decode();
  return JSON.parse(content);
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function manager(req: NextRequest) {
  const secret = req.cookies.get("tableq_session")?.value;
  if (!secret) return null;
  return db
    .prepare(
      "SELECT m.id,m.email FROM sessions s JOIN managers m ON m.id=s.manager_id WHERE s.token_hash=? AND s.expires>?",
    )
    .get(hash(secret), Date.now()) as { id: number; email: string } | undefined;
}
function publicInfo() {
  return {
    name: process.env.RESTAURANT_NAME || "The Olive Table",
    address:
      process.env.RESTAURANT_ADDRESS ||
      "24 Garden Avenue · Welcome to our table",
    capacity: Number(process.env.RESTAURANT_CAPACITY || 50),
    pushEnabled: pushConfigured(),
    smsEnabled: smsConfigured(),
    vapidKey: process.env.VAPID_PUBLIC_KEY || "",
    waiting: tickets().filter((t) => t.status === "waiting").length,
    appUrl: process.env.APP_URL || "",
  };
}
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/");
  const method = req.method;
  try {
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      const expected = process.env.APP_URL
        ? new URL(process.env.APP_URL).origin
        : req.nextUrl.origin;
      if (!origin || origin !== expected)
        return json({ error: "Request origin is not allowed." }, 403);
    }
    if (route === "health" && method === "GET")
      return json(
        { status: health() ? "ok" : "setup-required" },
        health() ? 200 : 503,
      );
    if (route === "public" && method === "GET") return json(publicInfo());
    if (route === "session" && method === "GET") {
      const user = manager(req);
      return user
        ? json({ user, ...publicInfo() })
        : json({ error: "Please sign in." }, 401);
    }
    if (route === "login" && method === "POST") {
      const ip =
        process.env.TRUST_PROXY === "true"
          ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "shared"
          : "shared";
      if (!rateLimit(`login:${ip}`, 20, 900))
        return json(
          { error: "Too many sign-in attempts. Try again in 15 minutes." },
          429,
        );
      const data = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(await readBody(req));
      const user = db
        .prepare("SELECT id,password FROM managers WHERE email=?")
        .get(data.email.toLowerCase()) as
        { id: number; password: string } | undefined;
      if (!user || !passwordMatches(data.password, user.password))
        return json({ error: "Email or password is incorrect." }, 401);
      db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      const secret = token();
      db.prepare(
        "INSERT INTO sessions(token_hash,manager_id,expires) VALUES (?,?,?)",
      ).run(hash(secret), user.id, Date.now() + 12 * 3600000);
      const res = json({ ok: true });
      res.cookies.set("tableq_session", secret, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 12 * 3600,
      });
      return res;
    }
    if (route === "logout" && method === "POST") {
      const secret = req.cookies.get("tableq_session")?.value;
      if (secret)
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(secret));
      const res = json({ ok: true });
      res.cookies.delete("tableq_session");
      return res;
    }
    if (route === "join" && method === "POST") {
      const ip =
        process.env.TRUST_PROXY === "true"
          ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "shared"
          : "shared";
      if (
        !rateLimit(
          `join:${ip}`,
          process.env.TRUST_PROXY === "true" ? 10 : 100,
          3600,
        )
      )
        return json(
          { error: "Too many check-ins. Please speak with the host." },
          429,
        );
      const data = guestSchema.parse(await readBody(req));
      if (!data.phone && !data.email)
        return json({ error: "Please provide a phone number or email." }, 400);
      if (data.phone && !data.consent)
        return json(
          { error: "Please consent to updates about this visit." },
          400,
        );
      return json(join({ ...data, priority: false, notes: "" }), 201);
    }
    if (path[0] === "guest" && path[1]) {
      const secret = path[1];
      const guest = findGuest(secret);
      if (!guest)
        return json({ error: "This guest link could not be found." }, 404);
      if (method === "GET" && path.length === 2)
        return json({ ...guestView(secret), restaurant: publicInfo() });
      if (method === "POST" && path[2] === "cancel") {
        if (!["waiting", "notified"].includes(guest.status))
          return json({ error: "This visit has already ended." }, 409);
        transition(guest.id, "cancelled");
        return json({ ok: true });
      }
      if (method === "POST" && path[2] === "subscribe") {
        if (!pushConfigured())
          return json(
            { error: "Push notifications are not configured yet." },
            503,
          );
        const sub = z
          .object({
            endpoint: z.url(),
            keys: z.object({
              p256dh: z.string().min(1).max(200),
              auth: z.string().min(1).max(200),
            }),
          })
          .parse(await readBody(req));
        const url = new URL(sub.endpoint);
        if (
          url.protocol !== "https:" ||
          !(
            url.hostname === "fcm.googleapis.com" ||
            url.hostname === "updates.push.services.mozilla.com" ||
            url.hostname.endsWith(".push.apple.com") ||
            url.hostname.endsWith(".notify.windows.com")
          )
        )
          return json({ error: "Unsupported push service." }, 400);
        db.prepare(
          "INSERT INTO subscriptions(ticket_id,subscription) VALUES (?,?) ON CONFLICT(ticket_id) DO UPDATE SET subscription=excluded.subscription",
        ).run(guest.id, JSON.stringify(sub));
        await deliverNotifications();
        return json({ ok: true });
      }
      return json({ error: "Not found." }, 404);
    }
    const user = manager(req);
    if (!user) return json({ error: "Please sign in." }, 401);
    if (route === "qr" && method === "GET") {
      const url = new URL(
        "/check-in",
        process.env.APP_URL || req.nextUrl.origin,
      ).toString();
      return new NextResponse(
        await QRCode.toString(url, { type: "svg", margin: 2, width: 360 }),
        {
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "no-store",
          },
        },
      );
    }
    if (route === "tickets" && method === "GET") {
      await deliverNotifications();
      return json({
        tickets: tickets(),
        notifications: db
          .prepare(
            "SELECT ticket_id,channel,status,last_error FROM notifications",
          )
          .all(),
        ...publicInfo(),
      });
    }
    if (route === "tickets" && method === "POST")
      return json(join(guestSchema.parse(await readBody(req))), 201);
    if (path[0] === "tickets" && path.length === 2) {
      const id = path[1];
      if (!tickets().find((t) => t.id === id))
        return json({ error: "Guest not found." }, 404);
      if (method === "PATCH") {
        const raw = await readBody(req);
        if (raw.action === "release") {
          const ticket = tickets().find((t) => t.id === id)!;
          if (ticket.status !== "served" || ticket.released_at)
            return json({ error: "This table is not occupied." }, 409);
          db.prepare("UPDATE tickets SET released_at=? WHERE id=?").run(
            new Date().toISOString(),
            id,
          );
          return json({ ok: true });
        }
        if (raw.status) {
          const status = z
            .enum(["waiting", "notified", "served", "cancelled"])
            .parse(raw.status);
          const result = transition(id, status);
          await deliverNotifications();
          return json(result);
        }
        const data = guestSchema.parse(raw);
        const current = tickets().find((t) => t.id === id)!;
        if (
          current.status === "notified" ||
          (current.status === "served" && !current.released_at)
        ) {
          const occupied = tickets()
            .filter(
              (t) =>
                t.id !== id &&
                (t.status === "notified" ||
                  (t.status === "served" && !t.released_at)),
            )
            .reduce((sum, t) => sum + t.party_size, 0);
          if (
            occupied + data.partySize >
            Number(process.env.RESTAURANT_CAPACITY || 50)
          )
            return json(
              { error: "Not enough free seats for this party size." },
              409,
            );
        }
        db.prepare(
          "UPDATE tickets SET name=?,phone=?,email=?,party_size=?,priority=?,notes=?,consent=? WHERE id=?",
        ).run(
          data.name,
          data.phone,
          data.email,
          data.partySize,
          data.priority ? 1 : 0,
          data.notes || "",
          data.consent ? 1 : 0,
          id,
        );
        return json({ ok: true });
      }
      if (method === "DELETE") {
        db.prepare("DELETE FROM tickets WHERE id=?").run(id);
        return json({ ok: true });
      }
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: error.issues[0].message }, 400);
    if (
      error instanceof Error &&
      error.message === "Request body is too large."
    )
      return json({ error: error.message }, 413);
    if (error instanceof SyntaxError)
      return json({ error: "Invalid request." }, 400);
    if (
      error instanceof Error &&
      /Cannot change|Guest not found|queue is full/.test(error.message)
    )
      return json({ error: error.message }, 409);
    console.error(
      "API operation failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
