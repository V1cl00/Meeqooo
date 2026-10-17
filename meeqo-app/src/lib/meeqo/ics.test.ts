import assert from "node:assert/strict";
import { test } from "node:test";
import { icsCalendar, icsFor, mapUrl, routeUrl } from "./ics.ts";

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

test("the duration sets the end, and a calendar can hold several meetups", () => {
  const text = icsCalendar([{ ...item, durationMin: 90 }, { ...item, id: "a2", startsAt: "2026-10-25T09:00:00.000Z" }], "MeeQo", new Date("2026-10-17T08:00:00.000Z"));
  assert.match(text, /DTEND:20261018T113000Z/);
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(text, /X-WR-CALNAME:MeeQo/);
});

test("the route link points at the coordinates", () => {
  assert.equal(routeUrl(49.0069, 8.4037), "https://www.openstreetmap.org/directions?to=49.0069%2C8.4037");
});
