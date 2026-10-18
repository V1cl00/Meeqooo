import { test } from "node:test";
import assert from "node:assert/strict";
import { isNowHere } from "./now-here.ts";

const now = Date.parse("2026-10-18T10:00:00Z");
const at = (min: number) => new Date(now + min * 60_000).toISOString();
const base = { durationMin: 90, km: 1, spotsLeft: 3, cancelled: false };

test("starts within the next 3 hours and within 2 km", () => {
  assert.equal(isNowHere({ ...base, startsAt: at(30) }, now), true);
  assert.equal(isNowHere({ ...base, startsAt: at(180) }, now), true);
  assert.equal(isNowHere({ ...base, startsAt: at(181) }, now), false);
});

test("distance: up to 2 km, wider on request", () => {
  assert.equal(isNowHere({ ...base, startsAt: at(30), km: 2 }, now), true);
  assert.equal(isNowHere({ ...base, startsAt: at(30), km: 2.4 }, now), false);
  assert.equal(isNowHere({ ...base, startsAt: at(30), km: 4.5 }, now, { km: 5 }), true);
  assert.equal(isNowHere({ ...base, startsAt: at(30), km: null }, now), false);
  assert.equal(isNowHere({ ...base, startsAt: at(30), km: null }, now, { hasOrigin: false }), true);
});

test("already running counts only while joinable", () => {
  assert.equal(isNowHere({ ...base, startsAt: at(-30) }, now), true);
  assert.equal(isNowHere({ ...base, startsAt: at(-30), spotsLeft: 0 }, now), false);
  assert.equal(isNowHere({ ...base, startsAt: at(-100) }, now), false);
  assert.equal(isNowHere({ ...base, startsAt: at(30), cancelled: true }, now), false);
});
