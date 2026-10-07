import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
else if (existsSync(".env")) process.loadEnvFile(".env");
const { db } = await import("../lib/db.ts");
import { passwordHash } from "../lib/security.ts";
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before running setup.",
  );
  process.exit(1);
}
db.prepare(
  "INSERT INTO managers(email,password,role) VALUES (?,?,'admin') ON CONFLICT(email) DO UPDATE SET password=excluded.password,role='admin'",
).run(email.toLowerCase(), passwordHash(password));
db.prepare("DELETE FROM sessions").run();
if (
  process.env.NODE_ENV === "production" &&
  email.toLowerCase() !== "admin@tableq.local"
)
  db.prepare("DELETE FROM managers WHERE email='admin@tableq.local'").run();
console.log("Manager account configured. Existing sessions revoked.");
