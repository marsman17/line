import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
else if (existsSync(".env")) process.loadEnvFile(".env");
const { db, health } = await import("../lib/db.ts");
import { passwordHash } from "../lib/security.ts";
const url = process.env.APP_URL;
if (!url) {
  throw new Error(
    "APP_URL is required for production. Set your public HTTPS address.",
  );
}
const parsed = new URL(url);
if (
  parsed.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(parsed.hostname)
)
  throw new Error("APP_URL must use HTTPS.");
if (
  parsed.username ||
  parsed.password ||
  parsed.pathname !== "/" ||
  parsed.search ||
  parsed.hash
)
  throw new Error(
    "APP_URL must be an origin without credentials, path, query, or fragment.",
  );
const capacity = Number(process.env.RESTAURANT_CAPACITY || 50);
if (!Number.isInteger(capacity) || capacity < 1 || capacity > 2000)
  throw new Error("RESTAURANT_CAPACITY must be an integer between 1 and 2000.");
for (const names of [
  ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
  ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
]) {
  const count = names.filter((n) => !!process.env[n]).length;
  if (count > 0 && count < names.length)
    throw new Error(
      `Incomplete notification configuration. Set all of: ${names.join(", ")}`,
    );
}
const defaultManager = db
  .prepare("SELECT id FROM managers WHERE email='admin@tableq.local'")
  .get() as { id: number } | undefined;
if (defaultManager) {
  db.prepare("DELETE FROM sessions WHERE manager_id=?").run(defaultManager.id);
  db.prepare("DELETE FROM managers WHERE id=?").run(defaultManager.id);
}
if (!health()) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !password ||
    password.length < 12
  )
    throw new Error(
      "First startup requires ADMIN_EMAIL and ADMIN_PASSWORD with at least 12 characters.",
    );
  db.prepare(
    "INSERT INTO managers(email,password,role) VALUES (?, ?, 'admin') ON CONFLICT(email) DO UPDATE SET password=excluded.password,role='admin'",
  ).run(email.toLowerCase(), passwordHash(password));
  console.log("Production manager account created.");
}
if (!process.env.VAPID_PUBLIC_KEY && !process.env.TWILIO_ACCOUNT_SID)
  console.warn(
    "External mobile alerts are disabled. Configure Web Push or SMS before live restaurant service.",
  );
console.log("TableQ production configuration validated.");
