import type { Ticket } from "./db";
/** Capacity-based planning only: never releases actual seats or changes queue order. */
export function waitEstimates(
  visits: Ticket[],
  capacity: number,
  serviceMinutes: number,
  now = Date.now(),
): Record<string, number | null> {
  const seats = Array.from({ length: capacity }, () => 0);
  let occupied = 0;
  for (const t of visits.filter(
    (t) => t.status === "notified" || (t.status === "served" && !t.released_at),
  )) {
    const elapsed =
      t.status === "served" && t.finished_at
        ? Math.max(0, (now - new Date(t.finished_at).getTime()) / 60000)
        : 0;
    const remaining = Math.max(5, serviceMinutes - elapsed);
    for (let i = 0; i < t.party_size && occupied < capacity; i++)
      seats[occupied++] = remaining;
  }
  const waiting = visits
    .filter((t) => t.status === "waiting")
    .sort(
      (a, b) =>
        b.priority - a.priority || a.joined_at.localeCompare(b.joined_at),
    );
  const result: Record<string, number | null> = {};
  let queueTime = 0,
    blocked = false;
  for (const t of waiting) {
    if (blocked || t.party_size > capacity) {
      result[t.id] = null;
      blocked = true;
      continue;
    }
    seats.sort((a, b) => a - b);
    const start = Math.max(queueTime, seats[t.party_size - 1]);
    result[t.id] = Math.ceil(start);
    queueTime = start;
    for (let i = 0; i < t.party_size; i++) seats[i] = start + serviceMinutes;
  }
  return result;
}
