import { test, beforeEach, after } from "node:test";
import webpush from "web-push";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
const dir = mkdtempSync(pathJoin(tmpdir(), "tableq-notifications-"));
process.env.DATABASE_PATH = pathJoin(dir, "test.sqlite");
const { db, join, transition } = await import("../lib/db.ts");
const { deliverNotifications } = await import("../lib/notifications.ts");
const originalFetch = globalThis.fetch;
const originalPush = webpush.sendNotification;
beforeEach(() => {
  db.exec(
    "DELETE FROM notifications; DELETE FROM subscriptions; DELETE FROM tickets;",
  );
  process.env.TWILIO_ACCOUNT_SID = "test-account";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
  process.env.TWILIO_FROM_NUMBER = "+15550000000";
});
after(() => {
  globalThis.fetch = originalFetch;
  webpush.sendNotification = originalPush;
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const create = () => {
  const t = join({
    name: "Test Guest",
    phone: "+15551234567",
    email: "",
    partySize: 2,
    consent: true,
  });
  transition(t.id, "notified");
  return t;
};
test("SMS outbox sends through the provider, records acceptance, and prevents repeated delivery", async () => {
  create();
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(init?.method, "POST");
    assert.ok(String(init?.body).includes("To=%2B15551234567"));
    return new Response("{}", { status: 201 });
  };
  await deliverNotifications();
  assert.equal(calls, 1);
  assert.equal(
    db.prepare("SELECT status FROM notifications WHERE channel='sms'").get()
      ?.status,
    "sent",
  );
  await deliverNotifications();
  assert.equal(calls, 1);
});
test("provider failure is retried with backoff, without claiming successful delivery", async () => {
  create();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", { status: 503 });
  };
  await deliverNotifications();
  const row = db
    .prepare(
      "SELECT status,attempts,next_attempt,last_error FROM notifications WHERE channel='sms'",
    )
    .get()!;
  assert.equal(row.status, "pending");
  assert.equal(row.attempts, 1);
  assert.ok(Number(row.next_attempt) > Date.now());
  assert.equal(row.last_error, "Delivery failed; check provider configuration");
  await deliverNotifications();
  assert.equal(calls, 1);
});
test("cancelled visits do not send stale alerts", async () => {
  const t = create();
  transition(t.id, "cancelled");
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", { status: 201 });
  };
  await deliverNotifications();
  assert.equal(calls, 0);
});
test("an existing delivery lease prevents another sender from duplicating its work", async () => {
  create();
  db.prepare(
    "UPDATE notifications SET status='processing',next_attempt=? WHERE channel='sms'",
  ).run(Date.now() + 60000);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", { status: 201 });
  };
  await deliverNotifications();
  assert.equal(calls, 0);
});

test("Web Push sends a table-ready payload without exposing private guest links", async () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:test@example.test";
  const t = create();
  db.prepare(
    "INSERT INTO subscriptions(ticket_id,subscription) VALUES (?,?)",
  ).run(
    t.id,
    JSON.stringify({
      endpoint: "https://fcm.googleapis.com/test",
      keys: { p256dh: "test-key", auth: "test-auth" },
    }),
  );
  let payload = "";
  webpush.sendNotification = async (_sub, body) => {
    payload = String(body);
    return { statusCode: 201, body: "", headers: {} };
  };
  globalThis.fetch = async () => new Response("{}", { status: 201 });
  await deliverNotifications();
  const data = JSON.parse(payload);
  assert.equal(data.title, "Your table is ready");
  assert.equal(data.ticketId, t.id);
  assert.ok(!payload.includes(t.token));
  assert.equal(
    db.prepare("SELECT status FROM notifications WHERE channel='push'").get()
      ?.status,
    "sent",
  );
});
test("expired push subscriptions are removed and marked failed", async () => {
  const t = create();
  db.prepare(
    "INSERT INTO subscriptions(ticket_id,subscription) VALUES (?,?)",
  ).run(
    t.id,
    JSON.stringify({
      endpoint: "https://fcm.googleapis.com/test",
      keys: { p256dh: "test-key", auth: "test-auth" },
    }),
  );
  webpush.sendNotification = async () => {
    throw Object.assign(new Error("Gone"), { statusCode: 410 });
  };
  globalThis.fetch = async () => new Response("{}", { status: 201 });
  await deliverNotifications();
  assert.equal(
    db
      .prepare("SELECT ticket_id FROM subscriptions WHERE ticket_id=?")
      .get(t.id),
    undefined,
  );
  assert.equal(
    db.prepare("SELECT status FROM notifications WHERE channel='push'").get()
      ?.status,
    "failed",
  );
});

test("SMS and push alerts identify the guest branch rather than the default restaurant", async () => {
  const { saveBranch } = await import("../lib/db.ts");
  const branch = saveBranch({
    name: "North Garden",
    address: "10 North Street",
    capacity: 10,
    opening_hours: "",
    archived: 0,
  });
  const t = join({
    name: "North Guest",
    phone: "+15551234567",
    email: "",
    partySize: 2,
    consent: true,
    branchId: branch.id,
  });
  transition(t.id, "notified");
  db.prepare("INSERT INTO subscriptions VALUES (?,?)").run(
    t.id,
    JSON.stringify({
      endpoint: "https://example.test/push",
      keys: { auth: "test", p256dh: "test" },
    }),
  );
  process.env.VAPID_PUBLIC_KEY = "test-key";
  process.env.VAPID_PRIVATE_KEY = "test-key";
  process.env.VAPID_SUBJECT = "mailto:test@example.test";
  const originalDetails = webpush.setVapidDetails;
  webpush.setVapidDetails = () => {};
  let smsBody = "",
    pushBody = "";
  globalThis.fetch = async (_url, init) => {
    smsBody = String(init?.body);
    return new Response("{}", { status: 201 });
  };
  webpush.sendNotification = async (_subscription, payload) => {
    pushBody = String(payload);
    return { statusCode: 201, body: "", headers: {} };
  };
  try {
    await deliverNotifications();
    assert.match(new URLSearchParams(smsBody).get("Body")!, /North Garden/);
    assert.match(JSON.parse(pushBody).body, /North Garden/);
  } finally {
    webpush.setVapidDetails = originalDetails;
  }
});
