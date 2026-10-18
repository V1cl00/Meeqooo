import assert from "node:assert/strict";
import { test } from "node:test";
import { addDaysBerlin } from "./time.ts";

test("a weekly meetup keeps its local hour when daylight saving ends", () => {
  // Sun 18 Oct 2026 10:00 Berlin (CEST). The clocks go back on 25 Oct.
  assert.equal(addDaysBerlin("2026-10-18T08:00:00.000Z", 7), "2026-10-25T09:00:00.000Z");
  assert.equal(addDaysBerlin("2026-10-18T08:00:00.000Z", 14), "2026-11-01T09:00:00.000Z");
});

test("a weekly meetup keeps its local hour when daylight saving starts", () => {
  // Sun 21 Mar 2027 10:00 Berlin (CET). The clocks go forward on 28 Mar.
  assert.equal(addDaysBerlin("2027-03-21T09:00:00.000Z", 7), "2027-03-28T08:00:00.000Z");
});

test("plain weeks without a clock change are exactly seven days", () => {
  assert.equal(addDaysBerlin("2026-06-01T08:00:00.000Z", 7), "2026-06-08T08:00:00.000Z");
});
