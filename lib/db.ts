import { restaurantUrl } from "./restaurant-links";
import { waitEstimates } from "./wait-estimates";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hash, passwordHash, token } from "./security.ts";
export type Status = "waiting" | "notified" | "served" | "cancelled";
export type Ticket = {
  id: string;
  branch_id: string;
  customer_id: string;
  no_show: number;
  queue_number: number;
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
// Additive migration preserves existing visits, sessions and notification records.
db.exec("BEGIN IMMEDIATE");
db.exec(`CREATE TABLE IF NOT EXISTS branches(id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 2000), opening_hours TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)));
CREATE TABLE IF NOT EXISTS manager_branches(manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE, branch_id TEXT NOT NULL REFERENCES branches(id), PRIMARY KEY(manager_id,branch_id));`);
if (
  !(db.prepare("PRAGMA table_info(branches)").all() as { name: string }[]).some(
    (c) => c.name === "service_minutes",
  )
)
  db.exec(
    "ALTER TABLE branches ADD COLUMN service_minutes INTEGER CHECK(service_minutes IS NULL OR service_minutes BETWEEN 5 AND 480)",
  );
for (const column of ["website_url", "menu_url"]) {
  if (
    !(
      db.prepare("PRAGMA table_info(branches)").all() as { name: string }[]
    ).some((c) => c.name === column)
  )
    db.exec(
      `ALTER TABLE branches ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`,
    );
}
db.prepare(
  "INSERT OR IGNORE INTO branches(id,name,address,capacity) VALUES ('main',?,?,?)",
).run(
  process.env.RESTAURANT_NAME || "The Olive Table",
  process.env.RESTAURANT_ADDRESS || "24 Garden Avenue · Welcome to our table",
  Number(process.env.RESTAURANT_CAPACITY || 50),
);
if (
  !(db.prepare("PRAGMA table_info(tickets)").all() as { name: string }[]).some(
    (c) => c.name === "branch_id",
  )
)
  db.exec(
    "ALTER TABLE tickets ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'main'",
  );
if (
  !(db.prepare("PRAGMA table_info(managers)").all() as { name: string }[]).some(
    (c) => c.name === "role",
  )
)
  db.exec(
    "ALTER TABLE managers ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','staff'))",
  );
db.exec(`CREATE INDEX IF NOT EXISTS tickets_branch_status ON tickets(branch_id,status,joined_at);
CREATE TRIGGER IF NOT EXISTS tickets_branch_insert BEFORE INSERT ON tickets WHEN NOT EXISTS(SELECT 1 FROM branches WHERE id=NEW.branch_id) BEGIN SELECT RAISE(ABORT,'Unknown branch'); END;
CREATE TRIGGER IF NOT EXISTS tickets_branch_update BEFORE UPDATE OF branch_id ON tickets WHEN NOT EXISTS(SELECT 1 FROM branches WHERE id=NEW.branch_id) BEGIN SELECT RAISE(ABORT,'Unknown branch'); END;`);
db.exec(`CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK(marketing_consent IN (0,1)), notes TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS customers_branch_contacts ON customers(branch_id,phone,email);`);
for (const column of [
  { name: "customer_id", sql: "customer_id TEXT REFERENCES customers(id)" },
  {
    name: "no_show",
    sql: "no_show INTEGER NOT NULL DEFAULT 0 CHECK(no_show IN (0,1))",
  },
  { name: "queue_number", sql: "queue_number INTEGER" },
]) {
  if (
    !(
      db.prepare("PRAGMA table_info(tickets)").all() as { name: string }[]
    ).some((c) => c.name === column.name)
  )
    db.exec("ALTER TABLE tickets ADD COLUMN " + column.sql);
}
// A stable profile ID keeps history attached when contact details are edited.
for (const t of db
  .prepare(
    "SELECT id,branch_id,name,phone,email FROM tickets WHERE customer_id IS NULL ORDER BY joined_at ASC,rowid ASC",
  )
  .all() as {
  id: string;
  branch_id: string;
  name: string;
  phone: string;
  email: string;
}[]) {
  const id = ensureCustomer(t.branch_id, t);
  db.prepare("UPDATE tickets SET customer_id=? WHERE id=?").run(id, t.id);
}
for (const t of db
  .prepare(
    "SELECT id,branch_id FROM tickets WHERE queue_number IS NULL ORDER BY joined_at ASC,rowid ASC",
  )
  .all() as { id: string; branch_id: string }[]) {
  const next = Number(
    db
      .prepare(
        "SELECT COALESCE(MAX(queue_number),0)+1 AS n FROM tickets WHERE branch_id=?",
      )
      .get(t.branch_id)!.n,
  );
  db.prepare("UPDATE tickets SET queue_number=? WHERE id=?").run(next, t.id);
}
db.exec(`CREATE INDEX IF NOT EXISTS tickets_customer_joined ON tickets(customer_id,joined_at);
CREATE TRIGGER IF NOT EXISTS tickets_customer_insert BEFORE INSERT ON tickets WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND branch_id=NEW.branch_id) BEGIN SELECT RAISE(ABORT,'Customer branch mismatch'); END;
CREATE TRIGGER IF NOT EXISTS tickets_customer_update BEFORE UPDATE OF customer_id,branch_id ON tickets WHEN NEW.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND branch_id=NEW.branch_id) BEGIN SELECT RAISE(ABORT,'Customer branch mismatch'); END;`);
db.exec("COMMIT");
export function ensureCustomer(
  branchId: string,
  input: { name: string; phone: string; email: string },
) {
  const existing =
    (input.phone
      ? db
          .prepare(
            "SELECT id FROM customers WHERE branch_id=? AND phone=? ORDER BY rowid ASC LIMIT 1",
          )
          .get(branchId, input.phone)
      : undefined) ||
    (input.email
      ? db
          .prepare(
            "SELECT id FROM customers WHERE branch_id=? AND lower(email)=? ORDER BY rowid ASC LIMIT 1",
          )
          .get(branchId, input.email.toLowerCase())
      : undefined) ||
    (!input.phone && !input.email
      ? db
          .prepare(
            "SELECT id FROM customers WHERE branch_id=? AND lower(name)=? AND phone='' AND email='' ORDER BY rowid ASC LIMIT 1",
          )
          .get(branchId, input.name.toLowerCase())
      : undefined);
  if (existing) return String(existing.id);
  const id = token().slice(0, 16);
  db.prepare(
    "INSERT INTO customers(id,branch_id,name,phone,email) VALUES (?,?,?,?,?)",
  ).run(id, branchId, input.name, input.phone, input.email);
  return id;
}
db.exec(
  `CREATE TABLE IF NOT EXISTS branch_logos(branch_id TEXT PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,image BLOB NOT NULL,version TEXT NOT NULL);`,
);
export type Branch = {
  website_url?: string;
  menu_url?: string;
  service_minutes?: number | null;
  logo_version?: string | null;
  id: string;
  name: string;
  address: string;
  capacity: number;
  opening_hours: string;
  archived: number;
};
export type Manager = { id: number; email: string; role: "admin" | "staff" };
export function branches(user?: Manager): Branch[] {
  return (
    user?.role === "staff"
      ? db
          .prepare(
            "SELECT b.*,l.version AS logo_version FROM branches b LEFT JOIN branch_logos l ON l.branch_id=b.id JOIN manager_branches m ON m.branch_id=b.id WHERE m.manager_id=? ORDER BY b.archived,b.name,b.id",
          )
          .all(user.id)
      : db
          .prepare(
            "SELECT b.*,l.version AS logo_version FROM branches b LEFT JOIN branch_logos l ON l.branch_id=b.id ORDER BY b.archived,b.name,b.id",
          )
          .all()
  ) as Branch[];
}
export function branch(id = "main") {
  return db
    .prepare(
      "SELECT b.*,l.version AS logo_version FROM branches b LEFT JOIN branch_logos l ON l.branch_id=b.id WHERE b.id=?",
    )
    .get(id) as Branch | undefined;
}
export function canAccessBranch(user: Manager, id: string) {
  return user.role === "admin"
    ? !!branch(id)
    : !!db
        .prepare(
          "SELECT branch_id FROM manager_branches WHERE manager_id=? AND branch_id=?",
        )
        .get(user.id, id);
}
export function saveBranch(input: Omit<Branch, "id">, id?: string) {
  return transaction(() => {
    const current = id ? branch(id) : undefined;
    if (id && !current) throw Error("Branch not found.");
    const websiteUrl = restaurantUrl(
      input.website_url ?? current?.website_url ?? "",
    );
    const menuUrl = restaurantUrl(input.menu_url ?? current?.menu_url ?? "");
    if (current) {
      const active = tickets(id).filter(
        (t) =>
          t.status === "waiting" ||
          t.status === "notified" ||
          (t.status === "served" && !t.released_at),
      );
      if (input.archived && active.length)
        throw Error(
          "Finish or cancel active visits and free tables before archiving this branch.",
        );
      const occupied = active
        .filter((t) => t.status === "notified" || t.status === "served")
        .reduce((sum, t) => sum + t.party_size, 0);
      if (input.capacity < occupied)
        throw Error("Capacity cannot be lower than currently reserved seats.");
      db.prepare(
        "UPDATE branches SET name=?,address=?,capacity=?,opening_hours=?,archived=?,service_minutes=?,website_url=?,menu_url=? WHERE id=?",
      ).run(
        input.name,
        input.address,
        input.capacity,
        input.opening_hours,
        input.archived,
        input.service_minutes === undefined
          ? (current.service_minutes ?? null)
          : input.service_minutes,
        websiteUrl,
        menuUrl,
        id!,
      );
    } else {
      id = token().slice(0, 12);
      db.prepare(
        "INSERT INTO branches(id,name,address,capacity,opening_hours,archived,service_minutes,website_url,menu_url) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        input.name,
        input.address,
        input.capacity,
        input.opening_hours,
        input.archived,
        input.service_minutes ?? null,
        websiteUrl,
        menuUrl,
      );
    }
    return branch(id)!;
  });
}
if (
  process.env.NODE_ENV !== "production" &&
  !db.prepare("SELECT id FROM managers WHERE role='admin' LIMIT 1").get()
)
  db.prepare("INSERT OR IGNORE INTO managers(email,password) VALUES (?,?)").run(
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
export function tickets(branchId?: string) {
  return db
    .prepare(
      `SELECT id,branch_id,customer_id,no_show,queue_number,name,phone,email,party_size,priority,status,joined_at,notified_at,finished_at,notes,consent,released_at FROM tickets ${branchId ? "WHERE branch_id=?" : ""} ORDER BY priority DESC, joined_at ASC, rowid ASC`,
    )
    .all(...(branchId ? [branchId] : [])) as Ticket[];
}
export function findGuest(secret: string) {
  return db
    .prepare(
      "SELECT id,branch_id,customer_id,no_show,queue_number,name,phone,email,party_size,priority,status,joined_at,notified_at,finished_at,notes,consent,released_at FROM tickets WHERE token_hash=?",
    )
    .get(hash(secret)) as Ticket | undefined;
}
export type GuestInput = {
  name: string;
  phone: string;
  email: string;
  partySize: number;
  branchId?: string;
  priority?: boolean;
  notes?: string;
  consent?: boolean;
};
export function join(input: GuestInput) {
  return transaction(() => {
    const location = branch(input.branchId || "main");
    if (!location || location.archived)
      throw Error("This branch is not accepting check-ins.");
    if (
      tickets(location.id).filter(
        (t) => t.status === "waiting" || t.status === "notified",
      ).length >= 200
    )
      throw new Error("The queue is full. Please speak with the host.");
    const secret = token();
    const id = token().slice(0, 12);
    db.prepare(
      "INSERT INTO tickets(id,token_hash,name,phone,email,party_size,priority,joined_at,notes,consent,branch_id,customer_id,queue_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
      location.id,
      ensureCustomer(location.id, input),
      Number(
        db
          .prepare(
            "SELECT COALESCE(MAX(queue_number),0)+1 AS n FROM tickets WHERE branch_id=?",
          )
          .get(location.id)!.n,
      ),
    );
    return { id, token: secret };
  });
}
export function guestView(secret: string) {
  const ticket = findGuest(secret);
  if (!ticket) return null;
  const active = tickets(ticket.branch_id).filter(
    (t) => t.status === "waiting",
  );
  const index = active.findIndex((t) => t.id === ticket.id);
  return {
    id: ticket.id,
    branchId: ticket.branch_id,
    name: ticket.name,
    partySize: ticket.party_size,
    status: ticket.status,
    joinedAt: ticket.joined_at,
    notifiedAt: ticket.notified_at,
    position: index >= 0 ? index + 1 : 0,
    estimatedMinutes:
      index >= 0
        ? branch(ticket.branch_id)?.service_minutes
          ? waitEstimates(
              tickets(ticket.branch_id),
              branch(ticket.branch_id)!.capacity,
              branch(ticket.branch_id)!.service_minutes!,
            )[ticket.id]
          : index * 5
        : 0,
    smsEligible: Boolean(ticket.phone && ticket.consent),
    pushEnabled: !!db
      .prepare("SELECT ticket_id FROM subscriptions WHERE ticket_id=?")
      .get(ticket.id),
  };
}
export function transition(id: string, status: Status, noShow = false) {
  return transaction(() => {
    const ticket = db.prepare("SELECT * FROM tickets WHERE id=?").get(id) as
      Ticket | undefined;
    if (!ticket) throw new Error("Guest not found.");
    if (noShow && (status !== "cancelled" || ticket.status !== "notified"))
      throw Error("Cannot mark this visit as a no-show.");
    const allowed: Record<Status, Status[]> = {
      waiting: ["notified", "cancelled"],
      notified: ["served", "cancelled", "waiting"],
      served: [],
      cancelled: [],
    };
    if (!allowed[ticket.status].includes(status))
      throw new Error(`Cannot change ${ticket.status} to ${status}.`);
    if (status === "notified" || status === "served") {
      const occupied = tickets(ticket.branch_id)
        .filter(
          (t) =>
            t.id !== id &&
            (t.status === "notified" ||
              (t.status === "served" && !t.released_at)),
        )
        .reduce((sum, t) => sum + t.party_size, 0);
      if (occupied + ticket.party_size > branch(ticket.branch_id)!.capacity)
        throw new Error(
          "Cannot change status: not enough free seats. Free a table first.",
        );
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE tickets SET status=?,notified_at=?,finished_at=?,no_show=? WHERE id=?",
    ).run(
      status,
      status === "notified"
        ? now
        : status === "waiting"
          ? null
          : ticket.notified_at,
      status === "served" || status === "cancelled" ? now : null,
      noShow ? 1 : 0,
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
  return !!db
    .prepare("SELECT id FROM managers WHERE role='admin' LIMIT 1")
    .get();
}
