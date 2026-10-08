import { z } from "zod";
import { db, transaction, type Manager } from "./db.ts";
import { AccountError, account } from "./account.ts";
import { passwordHash } from "./security.ts";
export type ManagedAccount = Manager & { name: string; branchIds: string[] };
export const managerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  role: z.enum(["admin", "staff"]),
  password: z.string().min(12).max(200).optional(),
  branchIds: z.array(z.string().min(1).max(40)).max(100).default([]),
});
function requireAdmin(actor: Manager) {
  if (
    actor.role !== "admin" ||
    !db
      .prepare("SELECT id FROM managers WHERE id=? AND role='admin'")
      .get(actor.id)
  )
    throw new AccountError("CMS administrator access required.", 403);
}
export function managerDirectory(actor: Manager): ManagedAccount[] {
  requireAdmin(actor);
  return (
    db
      .prepare(
        "SELECT m.id,m.email,m.role,COALESCE(s.name,substr(m.email,1,instr(m.email,'@')-1)) AS name FROM managers m LEFT JOIN manager_settings s ON s.manager_id=m.id ORDER BY m.role,m.email",
      )
      .all() as (Manager & { name: string })[]
  ).map((u) => ({
    ...u,
    branchIds: (
      db
        .prepare(
          "SELECT branch_id FROM manager_branches WHERE manager_id=? ORDER BY branch_id",
        )
        .all(u.id) as { branch_id: string }[]
    ).map((b) => b.branch_id),
  }));
}
export function saveManager(actor: Manager, input: unknown, id?: number) {
  requireAdmin(actor);
  const data = managerSchema.parse(input);
  return transaction(() => {
    requireAdmin(actor);
    if (id === actor.id)
      throw new AccountError(
        "Use Profile to edit your own account. Another CMS administrator must change your access or password.",
        409,
      );
    const target = id
      ? (db.prepare("SELECT id,role FROM managers WHERE id=?").get(id) as
          Manager | undefined)
      : undefined;
    if (id && !target)
      throw new AccountError("Manager account not found.", 404);
    if (
      target?.role === "admin" &&
      data.role !== "admin" &&
      (
        db
          .prepare("SELECT COUNT(*) AS n FROM managers WHERE role='admin'")
          .get() as { n: number }
      ).n <= 1
    )
      throw new AccountError(
        "The last CMS administrator cannot be demoted.",
        409,
      );
    if (!id && !data.password)
      throw new AccountError(
        "An initial password of at least 12 characters is required.",
      );
    if (data.role === "staff" && !data.branchIds.length)
      throw new AccountError("Assign at least one branch to a manager.");
    if (
      data.branchIds.some(
        (b) => !db.prepare("SELECT id FROM branches WHERE id=?").get(b),
      )
    )
      throw new AccountError("Choose valid branches.");
    const email = data.email.toLowerCase();
    const duplicate = db
      .prepare("SELECT id FROM managers WHERE email=?")
      .get(email) as { id: number } | undefined;
    if (duplicate && duplicate.id !== id)
      throw new AccountError("This email already has an account.", 409);
    const saved =
      id ||
      Number(
        db
          .prepare("INSERT INTO managers(email,password,role) VALUES (?,?,?)")
          .run(email, passwordHash(data.password!), data.role).lastInsertRowid,
      );
    if (id) {
      db.prepare("UPDATE managers SET email=?,role=? WHERE id=?").run(
        email,
        data.role,
        id,
      );
      if (data.password)
        db.prepare("UPDATE managers SET password=? WHERE id=?").run(
          passwordHash(data.password),
          id,
        );
      db.prepare("DELETE FROM sessions WHERE manager_id=?").run(id);
    }
    account({ id: saved, email, role: data.role });
    db.prepare("UPDATE manager_settings SET name=? WHERE manager_id=?").run(
      data.name,
      saved,
    );
    db.prepare("DELETE FROM manager_branches WHERE manager_id=?").run(saved);
    if (data.role === "staff")
      for (const b of new Set(data.branchIds))
        db.prepare(
          "INSERT INTO manager_branches(manager_id,branch_id) VALUES (?,?)",
        ).run(saved, b);
    return saved;
  });
}
export function removeManager(actor: Manager, id: number) {
  requireAdmin(actor);
  transaction(() => {
    requireAdmin(actor);
    if (actor.id === id)
      throw new AccountError(
        "You cannot remove your own CMS account here. Use Profile for account deletion.",
        409,
      );
    const target = db
      .prepare("SELECT role FROM managers WHERE id=?")
      .get(id) as { role: string } | undefined;
    if (!target) throw new AccountError("Manager account not found.", 404);
    if (
      target.role === "admin" &&
      (
        db
          .prepare("SELECT COUNT(*) AS n FROM managers WHERE role='admin'")
          .get() as { n: number }
      ).n <= 1
    )
      throw new AccountError(
        "The last CMS administrator cannot be removed.",
        409,
      );
    db.prepare("DELETE FROM sessions WHERE manager_id=?").run(id);
    db.prepare("DELETE FROM managers WHERE id=?").run(id);
  });
}
