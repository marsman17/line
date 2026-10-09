import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
const dir = mkdtempSync(pathJoin(tmpdir(), "tableq-customers-"));
process.env.DATABASE_PATH = pathJoin(dir, "test.sqlite");
process.env.TZ = "America/Los_Angeles";
const { db, join, tickets, transition, guestView, saveBranch } =
  await import("../lib/db.ts");
const { customerDirectory, updateCustomer, customerProfile } =
  await import("../lib/customers.ts");
const { datePreset, dateBounds, dateRangeLabel } =
  await import("../lib/customer-dates.ts");
beforeEach(() =>
  db.exec(
    "DELETE FROM notifications; DELETE FROM subscriptions; DELETE FROM tickets; DELETE FROM customers; DELETE FROM manager_branches; DELETE FROM branches WHERE id!='main';",
  ),
);
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function visit(
  name: string,
  email: string,
  branchId = "main",
  priority = false,
) {
  const t = join({
    name,
    email,
    branchId,
    priority,
    phone: "",
    partySize: 2,
    consent: true,
  });
  return tickets(branchId).find((v) => v.id === t.id)!;
}
test("repeat visits share a stable profile, but marketing consent remains independent from visit consent", () => {
  const a = visit("Hooriya", "hooriya@example.test");
  visit("Hooriya", "HOORIYA@example.test");
  const rows = customerDirectory("main");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].visits, 2);
  assert.equal(rows[0].marketing_consent, 0);
  assert.equal(rows[0].id, a.customer_id);
  assert.notEqual(a.queue_number, tickets()[1].queue_number);
});
test("profile edits preserve activity and guest status and match future check-ins using the updated contact", () => {
  const a = join({
    name: "Original",
    phone: "",
    email: "old@example.test",
    partySize: 2,
    consent: true,
  });
  const c = customerDirectory("main")[0];
  updateCustomer(c.id, "main", {
    name: "Updated",
    phone: "+15551234567",
    email: "new@example.test",
    notes: "Window seat",
    marketingConsent: true,
  });
  assert.equal(customerDirectory("main")[0].name, "Updated");
  assert.equal(customerDirectory("main")[0].history[0].id, a.id);
  assert.equal(guestView(a.token)?.name, "Original");
  assert.equal(tickets()[0].consent, 1);
  join({
    name: "Updated",
    phone: "+15551234567",
    email: "new@example.test",
    partySize: 3,
  });
  const rows = customerDirectory("main");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].visits, 2);
  assert.equal(rows[0].notes, "Window seat");
  assert.equal(rows[0].marketing_consent, 1);
});
test("date, priority, marketing and search filters use selected visits and sorting is deterministic", () => {
  const a = visit("Zoe", "zoe@example.test", "main", true);
  const b = visit("Amy", "amy@example.test");
  const c = visit("Zoe", "zoe@example.test");
  db.prepare("UPDATE tickets SET joined_at=? WHERE id=?").run(
    "2025-01-01T10:00:00.000Z",
    a.id,
  );
  db.prepare("UPDATE tickets SET joined_at=? WHERE id=?").run(
    "2026-10-07T10:00:00.000Z",
    b.id,
  );
  db.prepare("UPDATE tickets SET joined_at=? WHERE id=?").run(
    "2026-10-08T10:00:00.000Z",
    c.id,
  );
  const zoe = customerProfile(a.customer_id, "main")!;
  updateCustomer(zoe.id, "main", { ...zoe, marketingConsent: true });
  const selected = {
    from: "2026-10-07T00:00:00.000Z",
    to: "2026-10-09T00:00:00.000Z",
  };
  assert.equal(
    customerDirectory("main", { ...selected, priority: "yes" }).length,
    0,
  );
  assert.equal(
    customerDirectory("main", { ...selected, marketing: "granted" })[0].name,
    "Zoe",
  );
  assert.equal(
    customerDirectory("main", { ...selected, marketing: "not-granted" })[0]
      .name,
    "Amy",
  );
  assert.equal(
    customerDirectory("main", { ...selected, search: "AMY" })[0].name,
    "Amy",
  );
  assert.deepEqual(
    customerDirectory("main", { sort: "name", direction: "asc" }).map(
      (c) => c.name,
    ),
    ["Amy", "Zoe"],
  );
  assert.deepEqual(
    customerDirectory("main", { sort: "visits", direction: "desc" }).map(
      (c) => c.name,
    ),
    ["Zoe", "Amy"],
  );
  assert.equal(
    customerDirectory("main", { ...selected, to: "2026-10-08T10:00:00.000Z" })
      .length,
    1,
  );
});
test("profiles and edits are branch-scoped and conflicting contacts do not merge histories", () => {
  const branch = saveBranch({
    name: "North",
    address: "10 North",
    capacity: 5,
    opening_hours: "",
    archived: 0,
  });
  const main = visit("Main", "same@example.test");
  const north = visit("North", "same@example.test", branch.id);
  assert.notEqual(main.customer_id, north.customer_id);
  assert.equal(customerDirectory(branch.id).length, 1);
  assert.throws(
    () =>
      updateCustomer(main.customer_id, branch.id, {
        name: "Wrong",
        phone: "",
        email: "",
        notes: "",
        marketingConsent: true,
      }),
    /Customer not found/,
  );
  const other = visit("Other", "other@example.test");
  assert.throws(
    () =>
      updateCustomer(main.customer_id, "main", {
        name: "Wrong",
        phone: "",
        email: "other@example.test",
        notes: "",
        marketingConsent: true,
      }),
    /another customer/,
  );
  assert.equal(
    customerProfile(main.customer_id, "main")?.email,
    "same@example.test",
  );
  assert.equal(customerDirectory("main").length, 2);
  assert.throws(
    () =>
      db
        .prepare("UPDATE tickets SET customer_id=? WHERE id=?")
        .run(north.customer_id, main.id),
    /Customer branch mismatch/,
  );
});
test("only called guests can be marked as no-shows; ordinary cancellations are not no-shows", () => {
  const a = visit("Called", "called@example.test");
  const b = visit("Cancelled", "cancelled@example.test");
  assert.throws(() => transition(a.id, "cancelled", true), /Cannot mark/);
  transition(a.id, "notified");
  transition(a.id, "cancelled", true);
  transition(b.id, "cancelled");
  assert.equal(
    customerDirectory("main").find((c) => c.id === a.customer_id)?.noShows,
    1,
  );
  assert.equal(
    customerDirectory("main").find((c) => c.id === b.customer_id)?.noShows,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM notifications").get()?.n,
    0,
  );
});
test("date presets include complete local days and handle daylight saving boundaries", () => {
  const today = datePreset("today", new Date(2026, 9, 8, 13));
  assert.deepEqual(dateBounds(today), {
    from: "2026-10-08T07:00:00.000Z",
    to: "2026-10-09T07:00:00.000Z",
  });
  assert.equal(datePreset("365", new Date(2026, 9, 8)).start, "2025-10-09");
  assert.equal(
    datePreset("yesterday", new Date(2026, 9, 8)).start,
    "2026-10-07",
  );
  const fall = dateBounds({
    start: "2026-11-01",
    end: "2026-11-01",
    label: "Fall",
  });
  assert.equal(
    new Date(fall.to).getTime() - new Date(fall.from).getTime(),
    25 * 3600000,
  );
  const spring = dateBounds({
    start: "2026-03-08",
    end: "2026-03-08",
    label: "Spring",
  });
  assert.equal(
    new Date(spring.to).getTime() - new Date(spring.from).getTime(),
    23 * 3600000,
  );
});
test("custom customer date ranges use the selected locale, including Urdu digits", () => {
  const range = {
    start: "2026-10-08",
    end: "2026-10-09",
    label: "Custom dates",
  };
  assert.equal(dateRangeLabel(range, "en"), "Oct 8, 2026 – Oct 9, 2026");
  const label = dateRangeLabel(range, "ur-PK-u-nu-arabext");
  assert.match(label, /۲۰۲۶/);
  assert.match(label, /۸/);
  assert.match(label, /۹/);
  assert.equal(
    dateRangeLabel(datePreset("7"), "ur-PK-u-nu-arabext"),
    "Last 7 days",
  );
  assert.equal(
    dateRangeLabel({ ...range, end: range.start }, "en"),
    "Oct 8, 2026",
  );
});
