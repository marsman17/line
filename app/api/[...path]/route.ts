import { validRestaurantUrl } from "../../../lib/restaurant-links";
import { waitEstimates } from "../../../lib/wait-estimates";
import {
  saveCompanyLogo,
  removeCompanyLogo,
} from "../../../lib/company-logo.ts";
import {
  managerDirectory,
  saveManager,
  removeManager,
} from "../../../lib/managers";
import {
  account,
  updateAccount,
  deleteAccount,
  saveAvatar,
  feedbackList,
  submitFeedback,
  sendPhoneCode,
  verifyPhone,
  AccountError,
} from "../../../lib/account";
import {
  customerDirectory,
  customerProfile,
  updateCustomer,
} from "../../../lib/customers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import {
  db,
  tickets,
  join,
  findGuest,
  guestView,
  transition,
  rateLimit,
  health,
  branch,
  branches,
  canAccessBranch,
  saveBranch,
  transaction,
  type Manager,
} from "../../../lib/db";
import {
  hash,
  passwordHash,
  passwordMatches,
  token,
} from "../../../lib/security";
import {
  deliverNotifications,
  pushConfigured,
  smsConfigured,
} from "../../../lib/notifications";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const guestSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine(
      (v) => !v || /^\+[1-9]\d{7,14}$/.test(v),
      "Use a phone number with country code, e.g. +15551234567.",
    ),
  email: z.union([z.email(), z.literal("")]).default(""),
  partySize: z.number().int().min(1).max(20),
  priority: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
  consent: z.boolean().optional(),
});
async function readBody(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError("Missing request body.");
  const decoder = new TextDecoder();
  let content = "";
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) {
      await reader.cancel();
      throw new Error("Request body is too large.");
    }
    content += decoder.decode(value, { stream: true });
  }
  content += decoder.decode();
  return JSON.parse(content);
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function manager(req: NextRequest) {
  const secret = req.cookies.get("tableq_session")?.value;
  if (!secret) return null;
  return db
    .prepare(
      "SELECT m.id,m.email,m.role FROM sessions s JOIN managers m ON m.id=s.manager_id WHERE s.token_hash=? AND s.expires>?",
    )
    .get(hash(secret), Date.now()) as Manager | undefined;
}
const restaurantLinkSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    validRestaurantUrl,
    "Enter a valid http:// or https:// URL without login details.",
  )
  .optional();
const branchSchema = z.object({
  websiteUrl: restaurantLinkSchema,
  menuUrl: restaurantLinkSchema,
  serviceMinutes: z.number().int().min(5).max(480).nullable().optional(),
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(200),
  capacity: z.number().int().min(1).max(2000),
  openingHours: z.string().trim().max(500).default(""),
  archived: z.boolean().default(false),
});
const staffSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(12).max(200).optional(),
  branchIds: z.array(z.string().min(1).max(40)).min(1).max(100),
});
function publicInfo(id = "main") {
  const location = branch(id);
  if (!location) throw Error("Branch not found.");
  const estimates = location.service_minutes
    ? Object.values(
        waitEstimates(tickets(id), location.capacity, location.service_minutes),
      )
    : undefined;
  return {
    branchId: location.id,
    websiteUrl: location.website_url || "",
    menuUrl: location.menu_url || "",
    logoVersion: location.logo_version,
    serviceMinutes: location.service_minutes,
    estimatedWaitMinutes: estimates
      ? estimates.length
        ? estimates[0]
        : 0
      : undefined,
    name: location.name,
    address: location.address,
    capacity: location.capacity,
    openingHours: location.opening_hours,
    archived: !!location.archived,
    pushEnabled: pushConfigured(),
    smsEnabled: smsConfigured(),
    vapidKey: process.env.VAPID_PUBLIC_KEY || "",
    waiting: tickets(location.id).filter((t) => t.status === "waiting").length,
    appUrl: process.env.APP_URL || "",
  };
}
function staffList() {
  return (
    db
      .prepare(
        "SELECT id,email,role FROM managers WHERE role='staff' ORDER BY email",
      )
      .all() as Manager[]
  ).map((m) => ({
    ...m,
    branchIds: (
      db
        .prepare("SELECT branch_id FROM manager_branches WHERE manager_id=?")
        .all(m.id) as { branch_id: string }[]
    ).map((b) => b.branch_id),
  }));
}
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/");
  const method = req.method;
  try {
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      const expected = process.env.APP_URL
        ? new URL(process.env.APP_URL).origin
        : req.nextUrl.origin;
      if (!origin || origin !== expected)
        return json({ error: "Request origin is not allowed." }, 403);
    }
    if (route === "health" && method === "GET")
      return json(
        { status: health() ? "ok" : "setup-required" },
        health() ? 200 : 503,
      );
    if (
      path[0] === "branches" &&
      path[2] === "logo" &&
      path.length === 3 &&
      method === "GET"
    ) {
      const row = db
        .prepare("SELECT image FROM branch_logos WHERE branch_id=?")
        .get(path[1]) as { image: Uint8Array } | undefined;
      return row
        ? new NextResponse(new Uint8Array(row.image), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          })
        : json({ error: "No company logo." }, 404);
    }
    if (route === "public" && method === "GET")
      return branch(req.nextUrl.searchParams.get("branch") || "main")
        ? json(publicInfo(req.nextUrl.searchParams.get("branch") || "main"))
        : json({ error: "Branch not found." }, 404);
    if (route === "session" && method === "GET") {
      const user = manager(req);
      return user
        ? json({ user, branches: branches(user) })
        : json({ error: "Please sign in." }, 401);
    }
    if (route === "login" && method === "POST") {
      const ip =
        process.env.TRUST_PROXY === "true"
          ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "shared"
          : "shared";
      if (!rateLimit(`login:${ip}`, 20, 900))
        return json(
          { error: "Too many sign-in attempts. Try again in 15 minutes." },
          429,
        );
      const data = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(await readBody(req));
      const user = db
        .prepare("SELECT id,password FROM managers WHERE email=?")
        .get(data.email.toLowerCase()) as
        { id: number; password: string } | undefined;
      if (!user || !passwordMatches(data.password, user.password))
        return json({ error: "Email or password is incorrect." }, 401);
      db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      const secret = token();
      db.prepare(
        "INSERT INTO sessions(token_hash,manager_id,expires) VALUES (?,?,?)",
      ).run(hash(secret), user.id, Date.now() + 12 * 3600000);
      const res = json({ ok: true });
      res.cookies.set("tableq_session", secret, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 12 * 3600,
      });
      return res;
    }
    if (route === "logout" && method === "POST") {
      const secret = req.cookies.get("tableq_session")?.value;
      if (secret)
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(secret));
      const res = json({ ok: true });
      res.cookies.delete("tableq_session");
      return res;
    }
    if (route === "join" && method === "POST") {
      const ip =
        process.env.TRUST_PROXY === "true"
          ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "shared"
          : "shared";
      if (
        !rateLimit(
          `join:${ip}`,
          process.env.TRUST_PROXY === "true" ? 10 : 100,
          3600,
        )
      )
        return json(
          { error: "Too many check-ins. Please speak with the host." },
          429,
        );
      const data = guestSchema.parse(await readBody(req));
      if (!data.phone && !data.email)
        return json({ error: "Please provide a phone number or email." }, 400);
      if (data.phone && !data.consent)
        return json(
          { error: "Please consent to updates about this visit." },
          400,
        );
      const branchId = z
        .string()
        .min(1)
        .max(40)
        .parse(req.nextUrl.searchParams.get("branch") || "main");
      return json(join({ ...data, branchId, priority: false, notes: "" }), 201);
    }
    if (path[0] === "guest" && path[1]) {
      const secret = path[1];
      const guest = findGuest(secret);
      if (!guest)
        return json({ error: "This guest link could not be found." }, 404);
      if (method === "GET" && path.length === 2)
        return json({
          ...guestView(secret),
          restaurant: publicInfo(guest.branch_id),
        });
      if (method === "POST" && path[2] === "cancel") {
        if (!["waiting", "notified"].includes(guest.status))
          return json({ error: "This visit has already ended." }, 409);
        transition(guest.id, "cancelled");
        return json({ ok: true });
      }
      if (method === "POST" && path[2] === "subscribe") {
        if (!pushConfigured())
          return json(
            { error: "Push notifications are not configured yet." },
            503,
          );
        const sub = z
          .object({
            endpoint: z.url(),
            keys: z.object({
              p256dh: z.string().min(1).max(200),
              auth: z.string().min(1).max(200),
            }),
          })
          .parse(await readBody(req));
        const url = new URL(sub.endpoint);
        if (
          url.protocol !== "https:" ||
          !(
            url.hostname === "fcm.googleapis.com" ||
            url.hostname === "updates.push.services.mozilla.com" ||
            url.hostname.endsWith(".push.apple.com") ||
            url.hostname.endsWith(".notify.windows.com")
          )
        )
          return json({ error: "Unsupported push service." }, 400);
        db.prepare(
          "INSERT INTO subscriptions(ticket_id,subscription) VALUES (?,?) ON CONFLICT(ticket_id) DO UPDATE SET subscription=excluded.subscription",
        ).run(guest.id, JSON.stringify(sub));
        await deliverNotifications();
        return json({ ok: true });
      }
      return json({ error: "Not found." }, 404);
    }
    const user = manager(req);
    if (!user) return json({ error: "Please sign in." }, 401);
    if (route === "account") {
      if (method === "GET") return json(account(user));
      if (method === "PATCH")
        return json(updateAccount(user, await readBody(req)));
      if (method === "DELETE") {
        const { password } = z
          .object({ password: z.string().min(1).max(200) })
          .parse(await readBody(req));
        deleteAccount(user, password);
        const res = json({ ok: true });
        res.cookies.delete("tableq_session");
        return res;
      }
    }
    if (route === "account/avatar") {
      if (method === "GET") {
        const row = db
          .prepare("SELECT avatar FROM manager_settings WHERE manager_id=?")
          .get(user.id) as { avatar: Uint8Array } | undefined;
        return row?.avatar
          ? new NextResponse(new Uint8Array(row.avatar), {
              headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
              },
            })
          : json({ error: "No profile picture." }, 404);
      }
      if (method === "POST") {
        const reader = req.body?.getReader();
        if (!reader) throw new AccountError("Choose a picture.");
        let size = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2097152) {
            await reader.cancel();
            throw new AccountError("Picture must be no larger than 2 MB.", 413);
          }
          chunks.push(value);
        }
        return json(
          await saveAvatar(
            user,
            Buffer.concat(chunks),
            req.headers.get("content-type") || "",
          ),
        );
      }
    }
    if (route === "account/phone/send" && method === "POST") {
      const { phone } = z
        .object({ phone: z.string().max(30) })
        .parse(await readBody(req));
      await sendPhoneCode(user, phone);
      return json({ ok: true });
    }
    if (route === "account/phone/verify" && method === "POST") {
      const { code } = z
        .object({ code: z.string().length(6) })
        .parse(await readBody(req));
      return json(verifyPhone(user, code));
    }
    if (route === "feedback") {
      if (method === "GET") return json({ items: feedbackList(user) });
      if (method === "POST") {
        submitFeedback(user, await readBody(req));
        return json({ ok: true }, 201);
      }
    }
    if (path[0] === "feedback" && path.length === 2 && method === "PATCH") {
      if (user.role !== "admin")
        return json({ error: "Administrator access required." }, 403);
      const { resolved } = z
        .object({ resolved: z.boolean() })
        .parse(await readBody(req));
      const result = db
        .prepare("UPDATE feedback SET resolved=? WHERE id=?")
        .run(
          resolved ? 1 : 0,
          z.coerce.number().int().positive().parse(path[1]),
        );
      return result.changes
        ? json({ ok: true })
        : json({ error: "Feedback not found." }, 404);
    }

    if (path[0] === "cms") {
      if (user.role !== "admin")
        return json({ error: "CMS administrator access required." }, 403);
      if (route === "cms" && method === "GET")
        return json({
          user,
          branches: branches(user),
          managers: managerDirectory(user),
        });
      if (route === "cms/managers" && method === "POST") {
        saveManager(user, await readBody(req));
        return json({ managers: managerDirectory(user) }, 201);
      }
      if (path[1] === "managers" && path.length === 3) {
        const id = z.coerce.number().int().positive().parse(path[2]);
        if (method === "PATCH") {
          saveManager(user, await readBody(req), id);
          return json({ managers: managerDirectory(user) });
        }
        if (method === "DELETE") {
          removeManager(user, id);
          return json({ ok: true });
        }
      }
      return json({ error: "Not found." }, 404);
    }
    if (path[0] === "branches" && path[2] === "logo" && path.length === 3) {
      if (user.role !== "admin")
        return json(
          { error: "Only administrators can manage company logos." },
          403,
        );
      if (method === "DELETE") return json(removeCompanyLogo(user, path[1]));
      if (method === "POST") {
        const reader = req.body?.getReader();
        if (!reader) throw new AccountError("Choose a picture.");
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2097152) {
            await reader.cancel();
            throw new AccountError("Picture must be no larger than 2 MB.", 413);
          }
          chunks.push(value);
        }
        return json(
          await saveCompanyLogo(
            user,
            path[1],
            Buffer.concat(chunks),
            req.headers.get("content-type") || "",
          ),
        );
      }
      return json({ error: "Method not allowed." }, 405);
    }
    if (route === "branches" || path[0] === "branches") {
      if (route === "branches" && method === "GET")
        return json({ branches: branches(user), user });
      if (user.role !== "admin")
        return json({ error: "Only administrators can manage branches." }, 403);
      if (
        (route === "branches" && method === "POST") ||
        (path.length === 2 && method === "PATCH")
      ) {
        const d = branchSchema.parse(await readBody(req));
        return json(
          saveBranch(
            {
              name: d.name,
              address: d.address,
              capacity: d.capacity,
              opening_hours: d.openingHours,
              service_minutes: d.serviceMinutes,
              website_url: d.websiteUrl,
              menu_url: d.menuUrl,
              archived: d.archived ? 1 : 0,
            },
            method === "PATCH" ? path[1] : undefined,
          ),
          method === "POST" ? 201 : 200,
        );
      }
      return json({ error: "Not found." }, 404);
    }
    if (path[0] === "staff") {
      if (user.role !== "admin")
        return json({ error: "Only administrators can manage staff." }, 403);
      if (route === "staff" && method === "GET")
        return json({ staff: staffList() });
      if (
        (route === "staff" && method === "POST") ||
        (path.length === 2 && method === "PATCH")
      ) {
        const d = staffSchema.parse(await readBody(req));
        if (d.branchIds.some((id) => !branch(id)))
          return json({ error: "Choose valid branches." }, 400);
        const email = d.email.toLowerCase();
        const existing = db
          .prepare("SELECT id FROM managers WHERE email=?")
          .get(email) as { id: number } | undefined;
        const id =
          method === "PATCH"
            ? z.coerce.number().int().positive().parse(path[1])
            : undefined;
        if (existing && existing.id !== id)
          return json({ error: "This email already has an account." }, 409);
        if (method === "POST" && !d.password)
          return json(
            { error: "A password of at least 12 characters is required." },
            400,
          );
        if (
          id &&
          !db
            .prepare("SELECT id FROM managers WHERE id=? AND role='staff'")
            .get(id)
        )
          return json({ error: "Staff account not found." }, 404);
        transaction(() => {
          const staffId =
            id ||
            Number(
              db
                .prepare(
                  "INSERT INTO managers(email,password,role) VALUES (?,?,'staff')",
                )
                .run(email, passwordHash(d.password!)).lastInsertRowid,
            );
          db.prepare("UPDATE managers SET email=? WHERE id=?").run(
            email,
            staffId,
          );
          if (id && d.password)
            db.prepare("UPDATE managers SET password=? WHERE id=?").run(
              passwordHash(d.password),
              staffId,
            );
          db.prepare("DELETE FROM sessions WHERE manager_id=?").run(staffId);
          db.prepare("DELETE FROM manager_branches WHERE manager_id=?").run(
            staffId,
          );
          for (const b of new Set(d.branchIds))
            db.prepare("INSERT INTO manager_branches VALUES (?,?)").run(
              staffId,
              b,
            );
        });
        return json({ staff: staffList() }, method === "POST" ? 201 : 200);
      }
      if (path.length === 2 && method === "DELETE") {
        const id = z.coerce.number().int().positive().parse(path[1]);
        if (
          !db
            .prepare("SELECT id FROM managers WHERE id=? AND role='staff'")
            .get(id)
        )
          return json({ error: "Staff account not found." }, 404);
        transaction(() => {
          db.prepare("DELETE FROM sessions WHERE manager_id=?").run(id);
          db.prepare("DELETE FROM managers WHERE id=? AND role='staff'").run(
            id,
          );
        });
        return json({ ok: true });
      }
      return json({ error: "Not found." }, 404);
    }
    const accessible = branches(user);
    const scope =
      req.nextUrl.searchParams.get("branch") ||
      accessible.find((b) => b.id === "main")?.id ||
      accessible[0]?.id;
    if (scope === "all") {
      if (route !== "tickets" || method !== "GET")
        return json({ error: "Choose a branch for this action." }, 400);
      const ids = new Set(accessible.map((b) => b.id));
      return json({
        tickets: tickets().filter((t) => ids.has(t.branch_id)),
        notifications: [],
        branches: accessible,
        user,
        branchId: "all",
        name: "All branches",
        address: "Across your accessible branches",
        capacity: accessible.reduce((n, b) => n + b.capacity, 0),
        openingHours: "",
        archived: false,
        pushEnabled: pushConfigured(),
        smsEnabled: smsConfigured(),
        vapidKey: process.env.VAPID_PUBLIC_KEY || "",
        waiting: 0,
        appUrl: process.env.APP_URL || "",
      });
    }
    if (!scope || !canAccessBranch(user, scope))
      return json({ error: "You do not have access to this branch." }, 403);
    if (path[0] === "customers") {
      const query = z
        .object({
          from: z.iso.datetime().optional(),
          to: z.iso.datetime().optional(),
          search: z.string().max(200).optional(),
          priority: z.enum(["any", "yes", "no"]).optional(),
          marketing: z.enum(["any", "granted", "not-granted"]).optional(),
          sort: z.enum(["name", "visits", "last", "phone", "email"]).optional(),
          direction: z.enum(["asc", "desc"]).optional(),
        })
        .parse(
          Object.fromEntries(
            [...req.nextUrl.searchParams].filter(([key]) => key !== "branch"),
          ),
        );
      if (query.from && query.to && query.from >= query.to)
        return json({ error: "Choose a valid date range." }, 400);
      if (route === "customers" && method === "GET")
        return json({ customers: customerDirectory(scope, query) });
      if (path.length === 2 && method === "PATCH") {
        if (!customerProfile(path[1], scope))
          return json({ error: "Customer not found." }, 404);
        const data = z
          .object({
            name: z.string().trim().max(80),
            phone: z
              .string()
              .trim()
              .max(20)
              .refine(
                (v) => !v || /^\+[1-9]\d{7,14}$/.test(v),
                "Use a phone number with country code.",
              ),
            email: z.union([z.email(), z.literal("")]),
            marketingConsent: z.boolean(),
            notes: z.string().trim().max(1000),
          })
          .parse(await readBody(req));
        return json(updateCustomer(path[1], scope, data));
      }
      return json({ error: "Not found." }, 404);
    }
    if (route === "qr" && method === "GET") {
      const url = new URL(
        "/check-in",
        process.env.APP_URL || req.nextUrl.origin,
      ).toString();
      const checkInURL = new URL(url);
      checkInURL.searchParams.set("branch", scope);
      return new NextResponse(
        await QRCode.toString(checkInURL.toString(), {
          type: "svg",
          margin: 2,
          width: 360,
        }),
        {
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "no-store",
          },
        },
      );
    }
    if (route === "tickets" && method === "GET") {
      await deliverNotifications();
      return json({
        tickets: tickets(scope),
        branches: accessible,
        user,
        notifications: db
          .prepare(
            "SELECT n.ticket_id,n.channel,n.status,n.last_error FROM notifications n JOIN tickets t ON t.id=n.ticket_id WHERE t.branch_id=?",
          )
          .all(scope),
        ...publicInfo(scope),
      });
    }
    if (route === "tickets" && method === "POST")
      return json(
        join({ ...guestSchema.parse(await readBody(req)), branchId: scope }),
        201,
      );
    if (path[0] === "tickets" && path.length === 2) {
      const id = path[1];
      if (!tickets(scope).find((t) => t.id === id))
        return json({ error: "Guest not found." }, 404);
      if (method === "PATCH") {
        const raw = await readBody(req);
        if (raw.action === "release") {
          const ticket = tickets(scope).find((t) => t.id === id)!;
          if (ticket.status !== "served" || ticket.released_at)
            return json({ error: "This table is not occupied." }, 409);
          db.prepare("UPDATE tickets SET released_at=? WHERE id=?").run(
            new Date().toISOString(),
            id,
          );
          return json({ ok: true });
        }
        if (raw.status) {
          const status = z
            .enum(["waiting", "notified", "served", "cancelled"])
            .parse(raw.status);
          const result = transition(
            id,
            status,
            z.boolean().default(false).parse(raw.noShow),
          );
          await deliverNotifications();
          return json(result);
        }
        const data = guestSchema.parse(raw);
        const current = tickets(scope).find((t) => t.id === id)!;
        if (
          current.status === "notified" ||
          (current.status === "served" && !current.released_at)
        ) {
          const occupied = tickets(scope)
            .filter(
              (t) =>
                t.id !== id &&
                (t.status === "notified" ||
                  (t.status === "served" && !t.released_at)),
            )
            .reduce((sum, t) => sum + t.party_size, 0);
          if (occupied + data.partySize > branch(scope)!.capacity)
            return json(
              { error: "Not enough free seats for this party size." },
              409,
            );
        }
        db.prepare(
          "UPDATE tickets SET name=?,phone=?,email=?,party_size=?,priority=?,notes=?,consent=? WHERE id=?",
        ).run(
          data.name,
          data.phone,
          data.email,
          data.partySize,
          data.priority ? 1 : 0,
          data.notes || "",
          data.consent ? 1 : 0,
          id,
        );
        return json({ ok: true });
      }
      if (method === "DELETE") {
        transaction(() => {
          const customerId = tickets(scope).find(
            (t) => t.id === id,
          )!.customer_id;
          db.prepare("DELETE FROM tickets WHERE id=?").run(id);
          db.prepare(
            "DELETE FROM customers WHERE id=? AND NOT EXISTS(SELECT 1 FROM tickets WHERE customer_id=?)",
          ).run(customerId, customerId);
        });
        return json({ ok: true });
      }
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof AccountError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json({ error: error.issues[0].message }, 400);
    if (
      error instanceof Error &&
      error.message === "Request body is too large."
    )
      return json({ error: error.message }, 413);
    if (error instanceof SyntaxError)
      return json({ error: "Invalid request." }, 400);
    if (
      error instanceof Error &&
      /Cannot change|Cannot mark|Customer not found|contact belongs|Guest not found|queue is full|Branch not found|not accepting check-ins|before archiving|reserved seats/.test(
        error.message,
      )
    )
      return json({ error: error.message }, 409);
    console.error(
      "API operation failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
