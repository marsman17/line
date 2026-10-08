import { test } from "node:test";
import assert from "node:assert/strict";
import { waitEstimates } from "../lib/wait-estimates.ts";
import type { Ticket } from "../lib/db";
const now = Date.parse("2026-10-08T12:00:00Z");
const visit = (
  id: string,
  party_size: number,
  extra: Partial<Ticket> = {},
): Ticket =>
  ({
    id,
    party_size,
    priority: 0,
    status: "waiting",
    joined_at: "2026-10-08T11:00:00Z",
    released_at: null,
    finished_at: null,
    ...extra,
  }) as Ticket;
test("capacity and party sizes predict shared seating waves", () => {
  assert.deepEqual(
    waitEstimates([visit("a", 2), visit("b", 2), visit("c", 2)], 4, 60, now),
    { a: 0, b: 0, c: 60 },
  );
});
test("occupied seats use remaining service duration and released visits free seats", () => {
  const seated = visit("s", 4, {
    status: "served",
    finished_at: "2026-10-08T11:40:00Z",
  });
  assert.equal(waitEstimates([seated, visit("a", 2)], 4, 60, now).a, 40);
  assert.equal(
    waitEstimates(
      [{ ...seated, released_at: "2026-10-08T11:59:00Z" }, visit("a", 2)],
      4,
      60,
      now,
    ).a,
    0,
  );
});
test("priority ordering and FIFO are preserved without changing visits", () => {
  const data = [visit("a", 2), visit("p", 2, { priority: 1 }), visit("b", 1)];
  assert.deepEqual(waitEstimates(data, 2, 45, now), { p: 0, a: 45, b: 90 });
  assert.equal(data[0].id, "a");
});
test("overdue occupied seats retain a buffer and oversized parties do not get false estimates", () => {
  assert.equal(
    waitEstimates(
      [
        visit("s", 2, {
          status: "served",
          finished_at: "2026-10-08T08:00:00Z",
        }),
        visit("a", 2),
      ],
      2,
      60,
      now,
    ).a,
    5,
  );
  assert.deepEqual(waitEstimates([visit("a", 3), visit("b", 1)], 2, 60, now), {
    a: null,
    b: null,
  });
});
