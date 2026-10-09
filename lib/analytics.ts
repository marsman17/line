import type { Ticket } from "./db";

const day = 86_400_000;

/** Rolling reporting range, shared by charts and branch comparisons. */
export function analyticsTickets(
  tickets: Ticket[],
  range: number,
  now = Date.now(),
) {
  const start = now - (Number.isFinite(range) && range > 0 ? range : 30) * day;
  return tickets.filter((ticket) => {
    const joined = Date.parse(ticket.joined_at);
    return Number.isFinite(joined) && joined >= start && joined <= now;
  });
}

/** Aggregates actual arrivals; an absent measurement remains distinct from zero. */
export function analyticsSummary(
  tickets: Ticket[],
  range: number,
  now = Date.now(),
) {
  const selected = analyticsTickets(tickets, range, now);
  const hours = Array<number>(24).fill(0);
  const weekdays = Array<number>(7).fill(0);
  const measured: { ticket: Ticket; wait: number }[] = [];
  for (const ticket of selected) {
    const joined = new Date(ticket.joined_at);
    hours[joined.getHours()] += ticket.party_size;
    weekdays[joined.getDay()] += ticket.party_size;
    if (ticket.status !== "waiting" && ticket.notified_at) {
      const notified = Date.parse(ticket.notified_at);
      if (
        Number.isFinite(notified) &&
        notified >= joined.getTime() &&
        notified <= now
      )
        measured.push({ ticket, wait: (notified - joined.getTime()) / 60_000 });
    }
  }
  const average = (values: number[]) =>
    values.length
      ? Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        )
      : null;
  const served = selected.filter((ticket) => ticket.status === "served");
  const cancelled = selected.filter((ticket) => ticket.status === "cancelled");
  return {
    selected,
    served,
    cancelled,
    noShows: cancelled.filter((ticket) => ticket.no_show).length,
    notified: measured.map(({ ticket }) => ticket),
    average: average(measured.map(({ wait }) => wait)),
    hours,
    weekdays,
    partyWaits: Array.from({ length: 4 }, (_, group) =>
      average(
        measured
          .filter(({ ticket }) =>
            group === 3
              ? ticket.party_size >= 7
              : ticket.party_size >= group * 2 + 1 &&
                ticket.party_size <= group * 2 + 2,
          )
          .map(({ wait }) => wait),
      ),
    ),
  };
}
