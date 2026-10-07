import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hash, passwordHash, token } from "./security.ts";
export type Status = "waiting" | "notified" | "served" | "cancelled";
export type Ticket = {
  id: string;
  name: string;
  phone: string;
  email: string;
  party_size: number;
  priority: number;
  status: Status;
  joined_at: string;
  notified_at: string | null;
  finished_at: string | null;
  notes: string;
  consent: number;
  released_at: string | null;
};
const path = resolve(
  /* turbopackIgnore: true */ process.env.DATABASE_PATH ||
    "./data/tableq.sqlite",
);
mkdirSync(dirname(path), { recursive: true });
export const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS managers(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, manager_id INTEGER NOT NULL REFERENCES managers(id), expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', party_size INTEGER NOT NULL CHECK(party_size BETWEEN 1 AND 20), priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','notified','served','cancelled')), joined_at TEXT NOT NULL, notified_at TEXT, finished_at TEXT, notes TEXT NOT NULL DEFAULT '', released_at TEXT, consent INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS tickets_status_joined ON tickets(status,joined_at);
CREATE TABLE IF NOT EXISTS subscriptions(ticket_id TEXT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE, subscription TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE, channel TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, sent_at TEXT, next_attempt INTEGER NOT NULL DEFAULT 0, UNIQUE(ticket_id,channel));
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
`);
if (
  process.env.NODE_ENV !== "production" &&
  !db.prepare("SELECT id FROM managers LIMIT 1").get()
)
  db.prepare("INSERT INTO managers(email,password) VALUES (?,?)").run(
    "admin@tableq.local",
    passwordHash("tableq-dev-only"),
  );
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function rateLimit(key: string, limit: number, seconds: number) {
  const now = Date.now();
  return transaction(() => {
    db.prepare("DELETE FROM rate_limits WHERE expires < ?").run(now);
    const row = db
      .prepare("SELECT count FROM rate_limits WHERE key=?")
      .get(key) as { count: number } | undefined;
    if (row && row.count >= limit) return false;
    db.prepare(
      "INSERT INTO rate_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    ).run(key, now + seconds * 1000);
    return true;
  });
}
export function tickets() {
  return db
    .prepare(
      "SELECT id,name,phone,email,party_size,priority,status,joined_at,notified_at,finished_at,notes,consent,released_at FROM tickets ORDER BY priority DESC, joined_at ASC, rowid ASC",
    )
    .all() as Ticket[];
}
export function findGuest(secret: string) {
  return db
    .prepare(
      "SELECT id,name,phone,email,party_size,priority,status,joined_at,notified_at,finished_at,notes,consent,released_at FROM tickets WHERE token_hash=?",
    )
    .get(hash(secret)) as Ticket | undefined;
}
export type GuestInput = {
  name: string;
  phone: string;
  email: string;
  partySize: number;
  priority?: boolean;
  notes?: string;
  consent?: boolean;
};
export function join(input: GuestInput) {
  return transaction(() => {
    if (
      tickets().filter((t) => t.status === "waiting" || t.status === "notified")
        .length >= 200
    )
      throw new Error("The queue is full. Please speak with the host.");
    const secret = token();
    const id = token().slice(0, 12);
    db.prepare(
      "INSERT INTO tickets(id,token_hash,name,phone,email,party_size,priority,joined_at,notes,consent) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      hash(secret),
      input.name,
      input.phone,
      input.email,
      input.partySize,
      input.priority ? 1 : 0,
      new Date().toISOString(),
      input.notes || "",
      input.consent ? 1 : 0,
    );
    return { id, token: secret };
  });
}
export function guestView(secret: string) {
  const ticket = findGuest(secret);
  if (!ticket) return null;
  const active = tickets().filter((t) => t.status === "waiting");
  const index = active.findIndex((t) => t.id === ticket.id);
  return {
    id: ticket.id,
    name: ticket.name,
    partySize: ticket.party_size,
    status: ticket.status,
    joinedAt: ticket.joined_at,
    notifiedAt: ticket.notified_at,
    position: index >= 0 ? index + 1 : 0,
    estimatedMinutes: index >= 0 ? index * 5 : 0,
    smsEligible: Boolean(ticket.phone && ticket.consent),
    pushEnabled: !!db
      .prepare("SELECT ticket_id FROM subscriptions WHERE ticket_id=?")
      .get(ticket.id),
  };
}
export function transition(id: string, status: Status) {
  return transaction(() => {
    const ticket = db.prepare("SELECT * FROM tickets WHERE id=?").get(id) as
      Ticket | undefined;
    if (!ticket) throw new Error("Guest not found.");
    const allowed: Record<Status, Status[]> = {
      waiting: ["notified", "cancelled"],
      notified: ["served", "cancelled", "waiting"],
      served: [],
      cancelled: [],
    };
    if (!allowed[ticket.status].includes(status))
      throw new Error(`Cannot change ${ticket.status} to ${status}.`);
    if (status === "notified" || status === "served") {
      const occupied = tickets()
        .filter(
          (t) =>
            t.id !== id &&
            (t.status === "notified" ||
              (t.status === "served" && !t.released_at)),
        )
        .reduce((sum, t) => sum + t.party_size, 0);
      if (
        occupied + ticket.party_size >
        Number(process.env.RESTAURANT_CAPACITY || 50)
      )
        throw new Error(
          "Cannot change status: not enough free seats. Free a table first.",
        );
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE tickets SET status=?,notified_at=?,finished_at=? WHERE id=?",
    ).run(
      status,
      status === "notified"
        ? now
        : status === "waiting"
          ? null
          : ticket.notified_at,
      status === "served" || status === "cancelled" ? now : null,
      id,
    );
    if (status === "waiting" || status === "cancelled")
      db.prepare(
        "DELETE FROM notifications WHERE ticket_id=? AND status!='sent'",
      ).run(id);
    if (status === "notified") {
      const channels = ["push"];
      if (ticket.phone && ticket.consent) channels.push("sms");
      for (const channel of channels)
        db.prepare(
          "INSERT INTO notifications(ticket_id,channel,created_at) VALUES (?,?,?) ON CONFLICT(ticket_id,channel) DO UPDATE SET status='pending', attempts=0, last_error=NULL, next_attempt=0, created_at=excluded.created_at",
        ).run(id, channel, now);
    }
    return tickets().find((t) => t.id === id)!;
  });
}
export function health() {
  db.prepare("SELECT 1").get();
  return !!db.prepare("SELECT id FROM managers LIMIT 1").get();
}
