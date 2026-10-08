import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
const dir = mkdtempSync(join(tmpdir(), "tableq-logos-"));
process.env.DATABASE_PATH = join(dir, "db.sqlite");
const { db, branch, saveBranch } = await import("../lib/db.ts");
const { saveCompanyLogo, removeCompanyLogo } =
  await import("../lib/company-logo.ts");
const admin = db
  .prepare("SELECT id,email,role FROM managers WHERE role='admin'")
  .get() as import("../lib/db.ts").Manager;
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("company logos preserve transparency and proportions, replace safely, and stay branch scoped", async () => {
  const b = saveBranch({
    name: "North",
    address: "",
    capacity: 20,
    opening_hours: "",
    archived: 0,
  });
  const bytes = await sharp({
    create: {
      width: 800,
      height: 400,
      channels: 4,
      background: { r: 10, g: 140, b: 30, alpha: 0.4 },
    },
  })
    .png()
    .toBuffer();
  await saveCompanyLogo(admin, "main", bytes, "image/png");
  const first = branch("main")!.logo_version;
  assert.ok(first);
  assert.equal(branch(b.id)!.logo_version, null);
  const row = db
    .prepare("SELECT image FROM branch_logos WHERE branch_id=?")
    .get("main") as { image: Uint8Array };
  const meta = await sharp(row.image).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 128);
  assert.equal(meta.hasAlpha, true);
  await saveCompanyLogo(admin, "main", bytes, "image/png");
  assert.notEqual(branch("main")!.logo_version, first);
  await assert.rejects(
    saveCompanyLogo({ ...admin, role: "staff" }, "main", bytes, "image/png"),
    /administrators/,
  );
  await assert.rejects(
    saveCompanyLogo(admin, "main", Buffer.from("fake"), "image/png"),
    /invalid/,
  );
  await assert.rejects(
    saveCompanyLogo(admin, "main", bytes, "image/svg+xml"),
    /PNG/,
  );
  assert.ok(branch("main")!.logo_version);
  removeCompanyLogo(admin, "main");
  assert.equal(branch("main")!.logo_version, null);
});
