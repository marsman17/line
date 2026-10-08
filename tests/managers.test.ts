import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const dir = mkdtempSync(join(tmpdir(), "tableq-cms-"));
process.env.DATABASE_PATH = join(dir, "db.sqlite");
const { db, saveBranch, branches } = await import("../lib/db.ts");
const { managerDirectory, saveManager, removeManager } =
  await import("../lib/managers.ts");
const { passwordMatches } = await import("../lib/security.ts");
const admin = db
  .prepare("SELECT id,email,role FROM managers WHERE role='admin'")
  .get() as import("../lib/db.ts").Manager;
const north = saveBranch({
  name: "North",
  address: "North Street",
  capacity: 50,
  opening_hours: "",
  archived: 0,
});
const input = {
  name: "Branch Host",
  email: "host@example.test",
  role: "staff",
  password: "initial-password-123",
  branchIds: [north.id],
};
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("CMS creates branch managers and additional administrators with hashed passwords and scoped access", () => {
  const id = saveManager(admin, input);
  const host = managerDirectory(admin).find((m) => m.id === id)!;
  assert.equal(host.name, "Branch Host");
  assert.deepEqual(
    branches(host).map((b) => b.id),
    [north.id],
  );
  assert.ok(
    passwordMatches(
      input.password,
      (
        db.prepare("SELECT password FROM managers WHERE id=?").get(id) as {
          password: string;
        }
      ).password,
    ),
  );
  const cmsId = saveManager(admin, {
    ...input,
    email: "cms@example.test",
    name: "Owner Two",
    role: "admin",
    branchIds: [],
  });
  assert.equal(
    branches(managerDirectory(admin).find((m) => m.id === cmsId)!).length,
    2,
  );
  assert.ok(!("password" in managerDirectory(admin)[0]));
});
test("CMS validates account and branch inputs and rolls back rejected writes", () => {
  const count = managerDirectory(admin).length;
  assert.throws(() =>
    saveManager(admin, {
      ...input,
      email: "no-password@example.test",
      password: undefined,
    }),
  );
  assert.throws(() =>
    saveManager(admin, {
      ...input,
      email: "no-branches@example.test",
      branchIds: [],
    }),
  );
  assert.throws(() =>
    saveManager(admin, {
      ...input,
      email: "bad-branch@example.test",
      branchIds: ["unknown"],
    }),
  );
  assert.throws(() => saveManager(admin, input), /already has/);
  assert.equal(managerDirectory(admin).length, count);
});
test("account edits update roles and branch permissions, rotate passwords and revoke sessions", () => {
  const host = managerDirectory(admin).find((m) => m.email === input.email)!;
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
    "cms-test-session",
    host.id,
    Date.now() + 10000,
  );
  saveManager(
    admin,
    {
      ...input,
      name: "Promoted Host",
      role: "admin",
      branchIds: [],
      password: "replacement-password-123",
    },
    host.id,
  );
  const updated = managerDirectory(admin).find((m) => m.id === host.id)!;
  assert.equal(updated.role, "admin");
  assert.deepEqual(updated.branchIds, []);
  assert.equal(
    db.prepare("SELECT * FROM sessions WHERE manager_id=?").get(host.id),
    undefined,
  );
  assert.ok(
    passwordMatches(
      "replacement-password-123",
      (
        db.prepare("SELECT password FROM managers WHERE id=?").get(host.id) as {
          password: string;
        }
      ).password,
    ),
  );
  saveManager(admin, { ...input, password: undefined }, host.id);
  assert.deepEqual(
    branches(managerDirectory(admin).find((m) => m.id === host.id)!).map(
      (b) => b.id,
    ),
    [north.id],
  );
});
test("branch managers cannot administer accounts and administrators cannot accidentally mutate themselves", () => {
  const host = managerDirectory(admin).find((m) => m.email === input.email)!;
  assert.throws(() => managerDirectory(host), /administrator/);
  assert.throws(
    () => managerDirectory({ ...host, role: "admin" }),
    /administrator/,
  );
  assert.throws(
    () =>
      saveManager(host, {
        ...input,
        email: "attack@example.test",
        role: "admin",
      }),
    /administrator/,
  );
  assert.throws(() => removeManager(host, admin.id), /administrator/);
  assert.throws(
    () => saveManager(admin, { ...input, email: admin.email }, admin.id),
    /own account/,
  );
  assert.throws(() => removeManager(admin, admin.id), /own CMS/);
});
test("removing a manager cascades access and personal settings but preserves branches", () => {
  const host = managerDirectory(admin).find((m) => m.email === input.email)!;
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
    "remove-test",
    host.id,
    Date.now() + 10000,
  );
  removeManager(admin, host.id);
  assert.equal(
    db.prepare("SELECT * FROM managers WHERE id=?").get(host.id),
    undefined,
  );
  assert.equal(
    db
      .prepare("SELECT * FROM manager_settings WHERE manager_id=?")
      .get(host.id),
    undefined,
  );
  assert.equal(
    db
      .prepare("SELECT * FROM manager_branches WHERE manager_id=?")
      .get(host.id),
    undefined,
  );
  assert.equal(
    db.prepare("SELECT * FROM sessions WHERE manager_id=?").get(host.id),
    undefined,
  );
  assert.equal(branches().length, 2);
});
