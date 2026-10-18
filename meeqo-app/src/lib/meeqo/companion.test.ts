import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSign, moodFit, sliderStops, sortByMood, weekPicks, withinHours } from "./companion.ts";

const now = Date.parse("2026-10-18T10:00:00Z");
const base = { spotsLeft: 2, isHost: false, myStatus: null, cancelled: false, matchesInterest: false, friendsGoing: [] as unknown[], km: 5, title: "x" };
const at = (h: number) => new Date(now + h * 3_600_000).toISOString();

test("mood: active prefers sport, calm prefers coffee, new avoids known interests", () => {
  assert.equal(moodFit("Sport · Klettern", "aktiv"), 2);
  assert.equal(moodFit("Essen · Kaffee", "aktiv"), 0);
  assert.equal(moodFit("Essen · Kaffee", "ruhig"), 2);
  assert.equal(moodFit("Kultur · Museum", "neu", ["Kultur"]), 0);
  assert.equal(moodFit("Sport · Klettern", "neu", ["Kultur"]), 2);
});

test("sortByMood keeps order without mood and is stable", () => {
  const items = [{ category: "Essen · Kaffee" }, { category: "Sport · Laufen" }, { category: "Kultur · Kino" }];
  assert.deepEqual(sortByMood(items, ""), items);
  assert.deepEqual(sortByMood(items, "aktiv").map((i) => i.category), ["Sport · Laufen", "Essen · Kaffee", "Kultur · Kino"]);
});

test("weekPicks: three, one per main category, only open and within a week", () => {
  const items = [
    { ...base, id: "a", category: "Sport · Laufen", startsAt: at(5), matchesInterest: true },
    { ...base, id: "b", category: "Sport · Klettern", startsAt: at(6), matchesInterest: true },
    { ...base, id: "c", category: "Essen · Brunch", startsAt: at(30), friendsGoing: [1] },
    { ...base, id: "d", category: "Kultur · Kino", startsAt: at(40) },
    { ...base, id: "e", category: "Spiele · Quiz", startsAt: at(24 * 8) },
    { ...base, id: "f", category: "Wellness · Sauna", startsAt: at(3), spotsLeft: 0 },
  ];
  const picks = weekPicks(items, "", [], now);
  assert.deepEqual(picks.map((p) => p.item.id), ["a", "c", "d"]);
  assert.equal(picks.length, 3);
  assert.equal(picks.find((p) => p.item.id === "c")?.reason, "friends");
});

test("time slider: hours until the evening, filter keeps earlier starts", () => {
  const morning = new Date(2026, 9, 18, 10, 0);
  assert.equal(sliderStops(morning), 14);
  const items = [{ startsAt: at(1) }, { startsAt: at(4) }];
  assert.equal(withinHours(items, 2, 14, now).length, 1);
  assert.equal(withinHours(items, 14, 14, now).length, 2);
});

test("group sign is stable per id", () => {
  assert.deepEqual(groupSign("abc"), groupSign("abc"));
  assert.ok(groupSign("abc").color.hex.startsWith("#"));
});
