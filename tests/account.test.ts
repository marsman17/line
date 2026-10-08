import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
const dir = mkdtempSync(join(tmpdir(), "tableq-account-"));
process.env.DATABASE_PATH = join(dir, "db.sqlite");
const { db } = await import("../lib/db.ts");
const {
  account,
  updateAccount,
  saveAvatar,
  sendPhoneCode,
  verifyPhone,
  submitFeedback,
  feedbackList,
  deleteAccount,
} = await import("../lib/account.ts");
const { passwordHash } = await import("../lib/security.ts");
const admin = db
  .prepare("SELECT id,email,role FROM managers WHERE role='admin'")
  .get() as import("../lib/db.ts").Manager;
db.prepare(
  "INSERT INTO managers(email,password,role) VALUES (?,?,'staff')",
).run("staff@example.test", passwordHash("test-password-12345"));
const staff = db
  .prepare("SELECT id,email,role FROM managers WHERE role='staff'")
  .get() as typeof admin;
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("account preferences persist independently and email/role cannot be edited", () => {
  updateAccount(admin, {
    name: "Olive Host",
    language: "fr",
    theme: "light",
    email: "changed@example.test",
    role: "staff",
  });
  assert.equal(account(admin).name, "Olive Host");
  assert.equal(account(admin).language, "fr");
  assert.equal(account(admin).email, admin.email);
  assert.equal(account(staff).language, "en");
  assert.throws(() => updateAccount(admin, { language: "xx" }));
});
test("avatars are validated, decoded, resized and stripped of original contents", async () => {
  const png = await sharp({
    create: { width: 700, height: 300, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await saveAvatar(admin, png, "image/png");
  const row = db
    .prepare("SELECT avatar FROM manager_settings WHERE manager_id=?")
    .get(admin.id) as { avatar: Uint8Array };
  const meta = await sharp(row.avatar).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 256);
  assert.equal(meta.format, "jpeg");
  await assert.rejects(saveAvatar(admin, Buffer.from("<svg/>"), "image/png"));
  await assert.rejects(saveAvatar(admin, png, "image/svg+xml"));
  await assert.rejects(saveAvatar(admin, Buffer.alloc(2097153), "image/jpeg"));
});
test("verification fails closed without a provider and limits guesses; successful codes cannot be reused", async () => {
  await assert.rejects(sendPhoneCode(staff, "+15551234567"), /unavailable/);
  const originalFetch = globalThis.fetch;
  process.env.TWILIO_ACCOUNT_SID = "test";
  process.env.TWILIO_AUTH_TOKEN = "test";
  process.env.TWILIO_FROM_NUMBER = "+15550000000";
  let delivered = "";
  globalThis.fetch = async (_url, init) => {
    delivered = String((init!.body as URLSearchParams).get("Body"));
    return new Response("{}", { status: 201 });
  };
  try {
    await sendPhoneCode(staff, "+15551234567");
    const code = delivered.match(/\b\d{6}\b/)![0];
    const stored = db
      .prepare("SELECT code_hash FROM phone_challenges WHERE manager_id=?")
      .get(staff.id) as { code_hash: string };
    assert.ok(!stored.code_hash.includes(code));
    assert.throws(() => verifyPhone(admin, code));
    assert.throws(() => verifyPhone(staff, "000000"), /incorrect/);
    assert.equal(verifyPhone(staff, code).phone, "+15551234567");
    assert.throws(() => verifyPhone(staff, code), /expired/);
    await sendPhoneCode(staff, "+15551234568");
    for (let i = 0; i < 5; i++)
      assert.throws(() => verifyPhone(staff, "000000"));
    assert.throws(
      () => verifyPhone(staff, delivered.match(/\b\d{6}\b/)![0]),
      /expired/,
    );
    globalThis.fetch = async () => new Response("{}", { status: 500 });
    await assert.rejects(
      sendPhoneCode(staff, "+15551234569"),
      /delivery failed/,
    );
    assert.equal(
      db
        .prepare("SELECT * FROM phone_challenges WHERE manager_id=?")
        .get(staff.id),
      undefined,
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  }
});
test("support messages persist and staff can only view their own messages", () => {
  submitFeedback(admin, { category: "feature", comment: "Admin request" });
  submitFeedback(staff, { category: "general", comment: "Staff request" });
  assert.equal(feedbackList(admin).length, 2);
  assert.equal(feedbackList(staff).length, 1);
  assert.equal(feedbackList(staff)[0].comment, "Staff request");
  assert.throws(() =>
    submitFeedback(staff, { category: "unknown", comment: "bad" }),
  );
});
test("account deletion requires reauthentication, protects the final administrator and cascades personal data", () => {
  assert.throws(() => deleteAccount(staff, "wrong"), /incorrect/);
  assert.throws(
    () => deleteAccount(admin, "tableq-dev-only"),
    /last administrator/,
  );
  assert.ok(account(staff).canDelete);
  db.prepare(
    "INSERT INTO sessions(token_hash,manager_id,expires) VALUES (?,?,?)",
  ).run("dummy", staff.id, Date.now() + 10000);
  deleteAccount(staff, "test-password-12345");
  assert.equal(
    db.prepare("SELECT * FROM managers WHERE id=?").get(staff.id),
    undefined,
  );
  assert.equal(
    db
      .prepare("SELECT * FROM manager_settings WHERE manager_id=?")
      .get(staff.id),
    undefined,
  );
  assert.equal(
    db.prepare("SELECT * FROM sessions WHERE manager_id=?").get(staff.id),
    undefined,
  );
  assert.equal(feedbackList(admin).length, 1);
});
test("accent and Urdu preferences persist with validation", () => {
  updateAccount(admin, { accent: "#3b82f6", language: "ur" });
  assert.equal(account(admin).accent, "#3b82f6");
  assert.equal(account(admin).language, "ur");
  assert.throws(() => updateAccount(admin, { accent: "red" }));
  assert.equal(account(admin).accent, "#3b82f6");
});
