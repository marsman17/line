import { db, tickets, transaction, type Ticket } from "./db.ts";
export type CustomerProfile = {
  id: string;
  branch_id: string;
  name: string;
  phone: string;
  email: string;
  marketing_consent: number;
  notes: string;
};
export type CustomerRecord = CustomerProfile & {
  visits: number;
  last: string;
  priority: boolean;
  noShows: number;
  history: Ticket[];
};
export type CustomerFilters = {
  from?: string;
  to?: string;
  search?: string;
  priority?: "any" | "yes" | "no";
  marketing?: "any" | "granted" | "not-granted";
  sort?: "name" | "visits" | "last" | "phone" | "email";
  direction?: "asc" | "desc";
};
export function customerDirectory(
  branchId: string,
  filters: CustomerFilters = {},
): CustomerRecord[] {
  const profiles = db
    .prepare("SELECT * FROM customers WHERE branch_id=?")
    .all(branchId) as CustomerProfile[];
  const map = new Map<string, Ticket[]>();
  for (const t of tickets(branchId)) {
    if (filters.from && t.joined_at < filters.from) continue;
    if (filters.to && t.joined_at >= filters.to) continue;
    const visits = map.get(t.customer_id) || [];
    visits.push(t);
    map.set(t.customer_id, visits);
  }
  const search = (filters.search || "").trim().toLowerCase();
  const rows = profiles.flatMap((c) => {
    const history = map.get(c.id);
    if (!history?.length) return [];
    history.sort(
      (a, b) =>
        b.joined_at.localeCompare(a.joined_at) || a.id.localeCompare(b.id),
    );
    const row = {
      ...c,
      visits: history.length,
      last: history[0].joined_at,
      priority: history.some((t) => !!t.priority),
      noShows: history.filter((t) => !!t.no_show).length,
      history,
    };
    if (
      search &&
      !`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(search)
    )
      return [];
    if (
      (filters.priority === "yes" && !row.priority) ||
      (filters.priority === "no" && row.priority)
    )
      return [];
    if (
      (filters.marketing === "granted" && !c.marketing_consent) ||
      (filters.marketing === "not-granted" && c.marketing_consent)
    )
      return [];
    return [row];
  });
  const key = filters.sort || "last",
    direction = filters.direction || "desc";
  return rows.sort((a, b) => {
    const comparison =
      key === "visits"
        ? a.visits - b.visits
        : String(a[key]).localeCompare(String(b[key]), undefined, {
            sensitivity: "base",
            numeric: true,
          });
    return (
      comparison * (direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id)
    );
  });
}
export function customerProfile(id: string, branchId: string) {
  return db
    .prepare("SELECT * FROM customers WHERE id=? AND branch_id=?")
    .get(id, branchId) as CustomerProfile | undefined;
}
export function updateCustomer(
  id: string,
  branchId: string,
  input: {
    name: string;
    phone: string;
    email: string;
    marketingConsent: boolean;
    notes: string;
  },
) {
  return transaction(() => {
    if (!customerProfile(id, branchId)) throw Error("Customer not found.");
    // Avoid silently merging distinct histories when an edited contact belongs to another profile.
    const conflict =
      (input.phone
        ? db
            .prepare(
              "SELECT id FROM customers WHERE branch_id=? AND phone=? AND id!=?",
            )
            .get(branchId, input.phone, id)
        : undefined) ||
      (input.email
        ? db
            .prepare(
              "SELECT id FROM customers WHERE branch_id=? AND lower(email)=? AND id!=?",
            )
            .get(branchId, input.email.toLowerCase(), id)
        : undefined);
    if (conflict)
      throw Error("That contact belongs to another customer in this branch.");
    db.prepare(
      "UPDATE customers SET name=?,phone=?,email=?,marketing_consent=?,notes=? WHERE id=? AND branch_id=?",
    ).run(
      input.name,
      input.phone,
      input.email,
      input.marketingConsent ? 1 : 0,
      input.notes,
      id,
      branchId,
    );
    return customerProfile(id, branchId)!;
  });
}
