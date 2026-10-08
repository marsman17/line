import { randomInt } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { db, transaction, rateLimit, type Manager } from "./db.ts";
import { passwordHash, passwordMatches, token } from "./security.ts";
import { smsConfigured } from "./notifications.ts";
export const languages = ["en", "es", "pt", "de", "fr", "it", "ur"] as const;
export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  language: z.enum(languages).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color, for example #3b82f6.")
    .optional(),
});
export const feedbackSchema = z.object({
  category: z.enum(["general", "feature", "billing", "performance"]),
  comment: z.string().trim().min(1, "Please enter a comment.").max(4000),
});
export class AccountError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
db.exec(`CREATE TABLE IF NOT EXISTS manager_settings(manager_id INTEGER PRIMARY KEY REFERENCES managers(id) ON DELETE CASCADE,name TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'en',theme TEXT NOT NULL DEFAULT 'system',phone TEXT NOT NULL DEFAULT '',phone_verified_at TEXT,avatar BLOB,avatar_version TEXT);
CREATE TABLE IF NOT EXISTS phone_challenges(manager_id INTEGER PRIMARY KEY REFERENCES managers(id) ON DELETE CASCADE,phone TEXT NOT NULL,code_hash TEXT NOT NULL,nonce TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,ready INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,category TEXT NOT NULL,comment TEXT NOT NULL,created_at TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0);`);
if (
  !(
    db.prepare("PRAGMA table_info(manager_settings)").all() as {
      name: string;
    }[]
  ).some((c) => c.name === "accent")
)
  db.exec(
    "ALTER TABLE manager_settings ADD COLUMN accent TEXT NOT NULL DEFAULT '#f2aa35'",
  );
export type Account = Manager & {
  accent: string;
  name: string;
  language: (typeof languages)[number];
  theme: "light" | "dark" | "system";
  phone: string;
  phone_verified_at: string | null;
  avatar_version: string | null;
  canDelete: boolean;
  smsEnabled: boolean;
};
export function account(user: Manager): Account {
  db.prepare(
    "INSERT OR IGNORE INTO manager_settings(manager_id,name) VALUES (?,?)",
  ).run(user.id, user.email.split("@")[0].slice(0, 80));
  const profile = db
    .prepare(
      "SELECT name,language,theme,accent,phone,phone_verified_at,avatar_version FROM manager_settings WHERE manager_id=?",
    )
    .get(user.id);
  const admins = db
    .prepare("SELECT COUNT(*) AS n FROM managers WHERE role='admin'")
    .get() as { n: number };
  return {
    ...user,
    ...profile,
    canDelete: user.role !== "admin" || admins.n > 1,
    smsEnabled: smsConfigured(),
  } as Account;
}
export function updateAccount(user: Manager, input: unknown) {
  const data = settingsSchema.parse(input);
  account(user);
  for (const [key, value] of Object.entries(data))
    db.prepare(`UPDATE manager_settings SET ${key}=? WHERE manager_id=?`).run(
      value,
      user.id,
    );
  return account(user);
}
export function deleteAccount(user: Manager, password: string) {
  transaction(() => {
    const stored = db
      .prepare("SELECT password FROM managers WHERE id=?")
      .get(user.id) as { password: string };
    if (!passwordMatches(password, stored.password))
      throw new AccountError("Password is incorrect.", 403);
    if (!account(user).canDelete)
      throw new AccountError(
        "The last administrator cannot be deleted. Create another administrator first.",
        409,
      );
    db.prepare("DELETE FROM sessions WHERE manager_id=?").run(user.id);
    db.prepare("DELETE FROM managers WHERE id=?").run(user.id);
  });
}
export async function saveAvatar(user: Manager, bytes: Buffer, mime: string) {
  if (bytes.length > 2 * 1024 * 1024)
    throw new AccountError("Picture must be no larger than 2 MB.", 413);
  if (!["image/png", "image/jpeg"].includes(mime))
    throw new AccountError("Choose a PNG or JPG picture.");
  let image: Buffer;
  try {
    const decoded = sharp(bytes, {
      limitInputPixels: 16000000,
      failOn: "warning",
    });
    const meta = await decoded.metadata();
    if (
      meta.format !== (mime === "image/png" ? "png" : "jpeg") ||
      (meta.pages && meta.pages > 1)
    )
      throw Error();
    image = await decoded
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AccountError("This picture is invalid or too large to process.");
  }
  account(user);
  db.prepare(
    "UPDATE manager_settings SET avatar=?,avatar_version=? WHERE manager_id=?",
  ).run(image, token(), user.id);
  return account(user);
}
export function feedbackList(user: Manager) {
  return db
    .prepare(
      `SELECT f.id,f.category,f.comment,f.created_at,f.resolved,m.email,s.name FROM feedback f JOIN managers m ON m.id=f.manager_id LEFT JOIN manager_settings s ON s.manager_id=m.id ${user.role === "admin" ? "" : "WHERE f.manager_id=?"} ORDER BY f.id DESC LIMIT 100`,
    )
    .all(...(user.role === "admin" ? [] : [user.id]));
}
export function submitFeedback(user: Manager, input: unknown) {
  const data = feedbackSchema.parse(input);
  if (!rateLimit(`feedback:${user.id}`, 10, 3600))
    throw new AccountError("Too many messages. Please try again later.", 429);
  db.prepare(
    "INSERT INTO feedback(manager_id,category,comment,created_at) VALUES (?,?,?,?)",
  ).run(user.id, data.category, data.comment, new Date().toISOString());
}
export async function sendPhoneCode(user: Manager, phone: string) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new AccountError(
      "Use an international phone number with country code.",
    );
  if (!smsConfigured())
    throw new AccountError(
      "Phone verification is unavailable. Ask your administrator to configure SMS delivery.",
      503,
    );
  if (
    !rateLimit(`phone:${user.id}`, 3, 3600) ||
    !rateLimit(`phone-destination:${phone}`, 5, 3600)
  )
    throw new AccountError(
      "Too many verification requests. Try again in an hour.",
      429,
    );
  const code = String(randomInt(100000, 1000000)),
    nonce = token();
  db.prepare(
    "INSERT OR REPLACE INTO phone_challenges(manager_id,phone,code_hash,nonce,expires) VALUES (?,?,?,?,?)",
  ).run(user.id, phone, passwordHash(code), nonce, Date.now() + 600000);
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const result = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: phone,
          From: process.env.TWILIO_FROM_NUMBER!,
          Body: `Your TableQ verification code is ${code}. It expires in 10 minutes.`,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!result.ok) throw Error();
    db.prepare(
      "UPDATE phone_challenges SET ready=1 WHERE manager_id=? AND nonce=?",
    ).run(user.id, nonce);
  } catch {
    db.prepare(
      "DELETE FROM phone_challenges WHERE manager_id=? AND nonce=?",
    ).run(user.id, nonce);
    throw new AccountError(
      "SMS delivery failed. Please check the number or try again later.",
      502,
    );
  }
}
export function verifyPhone(user: Manager, code: string) {
  const challenge = db
    .prepare("SELECT * FROM phone_challenges WHERE manager_id=?")
    .get(user.id) as
    | {
        phone: string;
        code_hash: string;
        expires: number;
        attempts: number;
        ready: number;
      }
    | undefined;
  if (
    !challenge ||
    !challenge.ready ||
    challenge.expires < Date.now() ||
    challenge.attempts >= 5
  )
    throw new AccountError("This code has expired. Request a new code.");
  db.prepare(
    "UPDATE phone_challenges SET attempts=attempts+1 WHERE manager_id=?",
  ).run(user.id);
  if (!/^\d{6}$/.test(code) || !passwordMatches(code, challenge.code_hash))
    throw new AccountError("Verification code is incorrect.");
  account(user);
  transaction(() => {
    db.prepare(
      "UPDATE manager_settings SET phone=?,phone_verified_at=? WHERE manager_id=?",
    ).run(challenge.phone, new Date().toISOString(), user.id);
    db.prepare("DELETE FROM phone_challenges WHERE manager_id=?").run(user.id);
  });
  return account(user);
}
