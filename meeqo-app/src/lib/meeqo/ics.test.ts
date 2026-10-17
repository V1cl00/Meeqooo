import assert from "node:assert/strict";
import { test } from "node:test";
import { icsFor, mapUrl } from "./ics.ts";

const item = { id: "a1", title: "Laufen, acht Kilometer", description: "Mit Pause;\nund Kaffee", startsAt: "2026-10-18T10:00:00.000Z", placeName: "Schlossgarten", city: "Karlsruhe" };

test("the calendar file has a start two hours before its end and escaped text", () => {
  const text = icsFor(item, new Date("2026-10-17T08:00:00.000Z"));
  assert.match(text, /DTSTART:20261018T100000Z/);
  assert.match(text, /DTEND:20261018T120000Z/);
  assert.match(text, /SUMMARY:Laufen\\, acht Kilometer/);
  assert.ok(text.includes("DESCRIPTION:Mit Pause\\;\\nund Kaffee"));
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\n") && text.endsWith("END:VCALENDAR\r\n"));
});

test("the map link carries the coordinates", () => {
  assert.equal(mapUrl(49.0069, 8.4037), "https://www.openstreetmap.org/?mlat=49.0069&mlon=8.4037#map=16/49.0069/8.4037");
});
