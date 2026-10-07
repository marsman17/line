import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
const dir = mkdtempSync(pathJoin(tmpdir(), "tableq-branches-"));
process.env.DATABASE_PATH = pathJoin(dir, "test.sqlite");
process.env.RESTAURANT_CAPACITY = "6";
const {
  db,
  saveBranch,
  branch,
  branches,
  canAccessBranch,
  join,
  guestView,
  transition,
  tickets,
} = await import("../lib/db.ts");
beforeEach(() =>
  db.exec(
    "DELETE FROM notifications; DELETE FROM subscriptions; DELETE FROM tickets; DELETE FROM manager_branches; DELETE FROM branches WHERE id!='main'; DELETE FROM managers WHERE role='staff'; UPDATE branches SET capacity=6,archived=0 WHERE id='main';",
  ),
);
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const location = (name = "North", capacity = 4) =>
  saveBranch({
    name,
    address: "10 North Street",
    capacity,
    opening_hours: "Mon–Sun 12:00–22:00",
    archived: 0,
  });
const visit = (
  name: string,
  branchId = "main",
  partySize = 2,
  priority = false,
) =>
  join({
    name,
    branchId,
    partySize,
    priority,
    phone: "",
    email: "guest@example.test",
  });
test("queue ordering and capacity are independent for each branch", () => {
  const north = location();
  const first = visit("First");
  const second = visit("Second");
  const priority = visit("Priority", north.id, 4, true);
  assert.equal(guestView(first.token)?.position, 1);
  assert.equal(guestView(second.token)?.position, 2);
  assert.equal(guestView(priority.token)?.position, 1);
  transition(priority.id, "notified");
  transition(first.id, "notified");
  transition(second.id, "notified");
  assert.throws(
    () => transition(visit("Extra", north.id).id, "notified"),
    /not enough free seats/,
  );
  assert.equal(tickets("main").length, 2);
  assert.equal(tickets(north.id).length, 2);
  assert.equal(guestView(priority.token)?.branchId, north.id);
});
test("archiving blocks check-in, retains history and allows restoring a branch", () => {
  const north = location();
  const a = visit("North guest", north.id);
  assert.throws(
    () => saveBranch({ ...north, archived: 1 }, north.id),
    /before archiving/,
  );
  transition(a.id, "notified");
  transition(a.id, "served");
  assert.throws(
    () => saveBranch({ ...north, archived: 1 }, north.id),
    /before archiving/,
  );
  db.prepare("UPDATE tickets SET released_at=? WHERE id=?").run(
    new Date().toISOString(),
    a.id,
  );
  saveBranch({ ...north, archived: 1 }, north.id);
  assert.equal(guestView(a.token)?.status, "served");
  assert.throws(() => visit("Closed", north.id), /not accepting check-ins/);
  saveBranch({ ...north, archived: 0 }, north.id);
  assert.ok(visit("Restored", north.id).id);
});
test("branch edits cannot reduce capacity below reserved seats", () => {
  const north = location();
  const a = visit("Party", north.id, 4);
  transition(a.id, "notified");
  assert.throws(
    () => saveBranch({ ...north, capacity: 3 }, north.id),
    /reserved seats/,
  );
  assert.equal(branch(north.id)?.capacity, 4);
});
test("staff membership restricts branch visibility and administrator access includes new branches", () => {
  const north = location();
  const south = location("South");
  const id = Number(
    db
      .prepare(
        "INSERT INTO managers(email,password,role) VALUES ('staff@example.test','test','staff')",
      )
      .run().lastInsertRowid,
  );
  db.prepare("INSERT INTO manager_branches VALUES (?,?)").run(id, north.id);
  const staff = { id, email: "staff@example.test", role: "staff" as const };
  const admin = { id: 1, email: "admin@tableq.local", role: "admin" as const };
  assert.deepEqual(
    branches(staff).map((b) => b.id),
    [north.id],
  );
  assert.equal(canAccessBranch(staff, north.id), true);
  assert.equal(canAccessBranch(staff, south.id), false);
  assert.equal(canAccessBranch(staff, "main"), false);
  assert.equal(canAccessBranch(admin, south.id), true);
});
test("queue fullness is enforced per branch and unknown branch records are rejected", () => {
  const north = location();
  for (let i = 0; i < 200; i++) visit("Guest " + i);
  assert.throws(() => visit("Full"), /queue is full/);
  assert.ok(visit("Other branch", north.id).id);
  assert.throws(() => visit("Unknown", "unknown"), /not accepting check-ins/);
  assert.throws(
    () => db.prepare("UPDATE tickets SET branch_id='unknown'").run(),
    /Unknown branch/,
  );
});
test("legacy database migration preserves visits, private links, notification jobs and sessions on repeated startup", () => {
  const file = pathJoin(dir, "legacy.sqlite");
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE managers(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
 CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,manager_id INTEGER NOT NULL REFERENCES managers(id),expires INTEGER NOT NULL);
 CREATE TABLE tickets(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',party_size INTEGER NOT NULL,priority INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'waiting',joined_at TEXT NOT NULL,notified_at TEXT,finished_at TEXT,notes TEXT NOT NULL DEFAULT '',released_at TEXT,consent INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE notifications(id INTEGER PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,channel TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TEXT NOT NULL,sent_at TEXT,next_attempt INTEGER NOT NULL DEFAULT 0,UNIQUE(ticket_id,channel));
 INSERT INTO managers VALUES (7,'legacy@example.test','saved-password');
 INSERT INTO sessions VALUES ('saved-session',7,9999999999999);
 INSERT INTO tickets(id,token_hash,name,party_size,joined_at) VALUES ('visit','private-hash','Legacy guest',2,'2026-01-01T00:00:00Z');
 INSERT INTO notifications(ticket_id,channel,created_at) VALUES ('visit','push','2026-01-01T00:00:00Z');`);
  old.close();
  const script = `import assert from 'node:assert/strict';import {db,tickets,branch} from './lib/db.ts';assert.equal(tickets()[0].branch_id,'main');assert.equal(tickets()[0].name,'Legacy guest');assert.equal(db.prepare('SELECT token_hash FROM tickets').get().token_hash,'private-hash');assert.equal(db.prepare('SELECT token_hash FROM sessions').get().token_hash,'saved-session');assert.equal(db.prepare('SELECT role FROM managers WHERE id=7').get().role,'admin');assert.ok(branch('main'));assert.equal(db.prepare('SELECT ticket_id FROM notifications').get().ticket_id,'visit');db.close();`;
  for (let i = 0; i < 2; i++) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_PATH: file },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
  }
});

test("production startup retains staff and creates an administrator after removing the local development account", () => {
  const file = pathJoin(dir, "deployment.sqlite");
  const seed = `import {db} from './lib/db.ts'; const id=Number(db.prepare("INSERT INTO managers(email,password,role) VALUES ('staff@example.test','saved-password','staff')").run().lastInsertRowid);db.prepare("INSERT INTO manager_branches VALUES (?,'main')").run(id);db.close();`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_PATH: file,
    NODE_ENV: "development",
  };
  let result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", seed],
    { env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const prodEnv: NodeJS.ProcessEnv = {
    ...env,
    NODE_ENV: "production",
    APP_URL: "http://localhost:3000",
    ADMIN_EMAIL: "owner@example.test",
    ADMIN_PASSWORD: "production-password-12345",
  };
  result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/bootstrap.ts"],
    { env: prodEnv, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const check = `import assert from 'node:assert/strict';import {db,health} from './lib/db.ts';assert.ok(health());assert.equal(db.prepare("SELECT role FROM managers WHERE email='owner@example.test'").get().role,'admin');assert.equal(db.prepare("SELECT role FROM managers WHERE email='staff@example.test'").get().role,'staff');assert.equal(db.prepare("SELECT email FROM managers WHERE email='admin@tableq.local'").get(),undefined);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM manager_branches').get().n,1);db.close();`;
  result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", check],
    { env: prodEnv, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
