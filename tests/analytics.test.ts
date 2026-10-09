import { test } from "node:test";
import assert from "node:assert/strict";
import { analyticsSummary, analyticsTickets } from "../lib/analytics.ts";
import type { Ticket } from "../lib/db";

const now = new Date(2026, 9, 9, 12).getTime();
const ticket = (extra: Partial<Ticket> = {}): Ticket =>
  ({
    id: "visit",
    joined_at: new Date(2026, 9, 8, 10).toISOString(),
    notified_at: null,
    status: "waiting",
    party_size: 2,
    no_show: 0,
    ...extra,
  }) as Ticket;

test("reporting range excludes old, future, and malformed arrivals without changing input", () => {
  const visits = [
    ticket({
      id: "boundary",
      joined_at: new Date(now - 7 * 86_400_000).toISOString(),
    }),
    ticket({
      id: "old",
      joined_at: new Date(now - 7 * 86_400_000 - 1).toISOString(),
    }),
    ticket({ id: "future", joined_at: new Date(now + 1).toISOString() }),
    ticket({ id: "invalid", joined_at: "invalid" }),
  ];
  assert.deepEqual(
    analyticsTickets(visits, 7, now).map((visit) => visit.id),
    ["boundary"],
  );
  assert.equal(visits.length, 4);
});

test("hourly and weekday demand include early and late arrivals and reconcile with guests", () => {
  const summary = analyticsSummary(
    [
      ticket({
        joined_at: new Date(2026, 9, 8, 0, 5).toISOString(),
        party_size: 3,
      }),
      ticket({
        joined_at: new Date(2026, 9, 8, 23, 55).toISOString(),
        party_size: 5,
      }),
    ],
    7,
    now,
  );
  assert.equal(summary.hours.length, 24);
  assert.equal(summary.hours[0], 3);
  assert.equal(summary.hours[23], 5);
  assert.equal(
    summary.hours.reduce((sum, guests) => sum + guests, 0),
    8,
  );
  assert.equal(
    summary.weekdays.reduce((sum, guests) => sum + guests, 0),
    8,
  );
});

test("wait measurements distinguish a real zero-minute wait from absent or invalid timestamps", () => {
  const joined = new Date(2026, 9, 8, 10).toISOString();
  const summary = analyticsSummary(
    [
      ticket({
        id: "instant",
        status: "notified",
        joined_at: joined,
        notified_at: joined,
        party_size: 1,
      }),
      ticket({
        id: "ten-minutes",
        status: "notified",
        notified_at: new Date(2026, 9, 8, 10, 10).toISOString(),
        party_size: 3,
      }),
      ticket({
        id: "negative",
        status: "notified",
        notified_at: new Date(2026, 9, 8, 9).toISOString(),
        party_size: 5,
      }),
      ticket({
        id: "malformed",
        status: "notified",
        notified_at: "invalid",
        party_size: 7,
      }),
      ticket({
        id: "future",
        status: "notified",
        notified_at: new Date(now + 1).toISOString(),
        party_size: 7,
      }),
    ],
    30,
    now,
  );
  assert.equal(summary.average, 5);
  assert.deepEqual(summary.partyWaits, [0, 10, null, null]);
  assert.equal(summary.notified.length, 2);
  assert.equal(analyticsSummary([ticket()], 30, now).average, null);
});

test("cancelled totals distinguish no-shows and preserve actual seated and ongoing counts", () => {
  const summary = analyticsSummary(
    [
      ticket({ status: "served" }),
      ticket({ status: "cancelled", no_show: 1 }),
      ticket({ status: "cancelled" }),
      ticket(),
    ],
    30,
    now,
  );
  assert.equal(summary.selected.length, 4);
  assert.equal(summary.served.length, 1);
  assert.equal(summary.cancelled.length, 2);
  assert.equal(summary.noShows, 1);
});

test("wait statistics include called cancellations but ignore stale notification times on waiting visits", () => {
  const notified_at = new Date(2026, 9, 8, 10, 20).toISOString();
  const summary = analyticsSummary(
    [
      ticket({ status: "notified", notified_at }),
      ticket({ status: "served", notified_at }),
      ticket({ status: "cancelled", no_show: 1, notified_at }),
      ticket({ status: "waiting", notified_at }),
    ],
    30,
    now,
  );
  assert.equal(summary.notified.length, 3);
  assert.equal(summary.average, 20);
  assert.equal(summary.noShows, 1);
});
