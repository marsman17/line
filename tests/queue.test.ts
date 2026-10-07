import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
const dir = mkdtempSync(pathJoin(tmpdir(), "tableq-test-"));
process.env.DATABASE_PATH = pathJoin(dir, "test.sqlite");
process.env.RESTAURANT_CAPACITY = "6";
const { db, join, guestView, transition, tickets, rateLimit } =
  await import("../lib/db.ts");
const { hash, passwordHash, passwordMatches } =
  await import("../lib/security.ts");
beforeEach(() =>
  db.exec(
    "DELETE FROM notifications; DELETE FROM subscriptions; DELETE FROM tickets; DELETE FROM rate_limits;",
  ),
);
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const guest = (name: string, size = 2, priority = false, consent = false) =>
  join({
    name,
    partySize: size,
    priority,
    phone: "+15551234567",
    email: "",
    consent,
  });
test("QR check-in creates a private ticket; priority and FIFO determine position", () => {
  const a = guest("A");
  const b = guest("B");
  const c = guest("C", 2, true);
  assert.equal(guestView(c.token)?.position, 1);
  assert.equal(guestView(a.token)?.position, 2);
  assert.equal(guestView(b.token)?.position, 3);
  assert.equal(guestView("incorrect-secret"), null);
  const stored = db
    .prepare("SELECT token_hash FROM tickets WHERE id=?")
    .get(a.id);
  assert.equal(stored?.token_hash, hash(a.token));
  assert.ok(!JSON.stringify(tickets()).includes(a.token));
});
test("complete check-in, notification, seating, and table release workflow", () => {
  const a = guest("A", 2, false, true);
  transition(a.id, "notified");
  assert.equal(guestView(a.token)?.status, "notified");
  assert.equal(guestView(a.token)?.position, 0);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM notifications").get()?.count,
    2,
  );
  transition(a.id, "served");
  assert.ok(guestView(a.token));
  assert.ok(tickets()[0].finished_at);
  db.prepare("UPDATE tickets SET released_at=? WHERE id=?").run(
    new Date().toISOString(),
    a.id,
  );
  assert.ok(tickets()[0].released_at);
  assert.throws(() => transition(a.id, "waiting"), /Cannot change/);
});
test("capacity includes called parties and seated guests; a freed table restores capacity", () => {
  const a = guest("A", 4);
  const b = guest("B", 3);
  transition(a.id, "notified");
  assert.throws(() => transition(b.id, "notified"), /not enough free seats/);
  assert.equal(guestView(b.token)?.status, "waiting");
  transition(a.id, "served");
  assert.throws(() => transition(b.id, "notified"), /not enough free seats/);
  db.prepare("UPDATE tickets SET released_at=? WHERE id=?").run(
    new Date().toISOString(),
    a.id,
  );
  transition(b.id, "notified");
  assert.equal(guestView(b.token)?.status, "notified");
});
test("cancellation and return-to-queue remove stale notification jobs", () => {
  const a = guest("A");
  transition(a.id, "notified");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM notifications").get()?.count,
    1,
  );
  transition(a.id, "waiting");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM notifications").get()?.count,
    0,
  );
  transition(a.id, "cancelled");
  assert.equal(guestView(a.token)?.status, "cancelled");
  assert.throws(() => transition(a.id, "served"), /Cannot change/);
});
test("SMS notification jobs require explicit visit consent", () => {
  const a = guest("A");
  transition(a.id, "notified");
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM notifications WHERE channel='sms'",
      )
      .get()?.count,
    0,
  );
});
test("rate limits expire and passwords use salted verification", () => {
  assert.equal(rateLimit("login", 2, 30), true);
  assert.equal(rateLimit("login", 2, 30), true);
  assert.equal(rateLimit("login", 2, 30), false);
  db.prepare("UPDATE rate_limits SET expires=0").run();
  assert.equal(rateLimit("login", 2, 30), true);
  const encoded = passwordHash("a-long-password");
  assert.ok(passwordMatches("a-long-password", encoded));
  assert.ok(!passwordMatches("wrong-password", encoded));
  assert.notEqual(encoded, passwordHash("a-long-password"));
});
test("party-size database constraint blocks invalid records", () => {
  assert.throws(() => guest("A", 0));
  assert.equal(tickets().length, 0);
});
