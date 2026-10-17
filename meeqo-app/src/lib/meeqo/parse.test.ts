import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMeetup } from "./parse.ts";

// Friday 16 Oct 2026, 12:00 Berlin
const now = new Date("2026-10-16T10:00:00.000Z");

test("weekday, time, place, group size and category from one sentence", () => {
  const result = parseMeetup("Samstag 10 Uhr Bouldern am Ostkreuz, sechs Leute", now);
  assert.equal(result.when, "2026-10-17T10:00");
  assert.equal(result.spots, 6);
  assert.equal(result.placeName, "Ostkreuz");
  assert.equal(result.category, "Sport · Klettern");
  assert.equal(result.title, "Bouldern am Ostkreuz");
});

test("tomorrow, clock time with minutes and 'für 4'", () => {
  const result = parseMeetup("Morgen 18:30 Brunch bei Giulia für 4", now);
  assert.equal(result.when, "2026-10-17T18:30");
  assert.equal(result.spots, 4);
  assert.equal(result.placeName, "Giulia");
  assert.equal(result.category, "Essen · Brunch");
  assert.equal(result.title, "Brunch bei Giulia");
});

test("a time that has passed today means tomorrow, duration is read", () => {
  const result = parseMeetup("Laufen im Schlossgarten um 9 Uhr, 90 Minuten", now);
  assert.equal(result.when, "2026-10-17T09:00");
  assert.equal(result.durationMin, 90);
  assert.equal(result.placeName, "Schlossgarten");
});

test("a later time today stays today", () => {
  assert.equal(parseMeetup("Kaffee heute um 17 Uhr", now).when, "2026-10-16T17:00");
});

test("a weekday without time gets 10:00, and 'am Sonntag' is not a place", () => {
  const result = parseMeetup("Wandern am Sonntag", now);
  assert.equal(result.when, "2026-10-18T10:00");
  assert.equal(result.placeName, "");
  assert.equal(result.category, "Outdoor · Wandern");
});

test("an explicit date rolls to next year when it has passed", () => {
  assert.equal(parseMeetup("Spieleabend am 3.1. um 19 Uhr", now).when, "2027-01-03T19:00");
  assert.equal(parseMeetup("Kino am 24.10. 20:15", now).when, "2026-10-24T20:15");
});

test("nothing recognised leaves fields empty instead of guessing", () => {
  const result = parseMeetup("Irgendwas Nettes", now);
  assert.equal(result.when, "");
  assert.equal(result.spots, null);
  assert.equal(result.category, "");
  assert.equal(result.title, "Irgendwas Nettes");
});
