import assert from "node:assert/strict";
import { test } from "node:test";
import { fold, googleTemplateUrl, icsCalendar, icsFor, mapUrl, routeUrl, subscribeUrls } from "./ics.ts";

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

test("a feed marks requests as tentative and cancelled meetups as cancelled, with refresh hints and Berlin zone", () => {
  const text = icsCalendar(
    [
      { ...item, status: "tentative" },
      { ...item, id: "a3", status: "cancelled" },
    ],
    "MeeQo",
    new Date("2026-10-17T08:00:00.000Z"),
  );
  assert.match(text, /STATUS:TENTATIVE/);
  assert.match(text, /STATUS:CANCELLED/);
  assert.match(text, /SUMMARY:Abgesagt: Laufen\\, acht Kilometer/);
  assert.match(text, /UID:a3@meeqo/);
  assert.match(text, /X-PUBLISHED-TTL:PT1H/);
  assert.match(text, /REFRESH-INTERVAL;VALUE=DURATION:PT1H/);
  assert.match(text, /X-WR-TIMEZONE:Europe\/Berlin/);
  assert.match(text, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Berlin/);
  // times stay in UTC so the zone cannot shift them
  assert.match(text, /DTSTART:20261018T100000Z/);
});

test("the UID is stable for the same meetup and long lines are folded", () => {
  const first = icsFor(item, new Date("2026-10-17T08:00:00.000Z"));
  const later = icsFor({ ...item, title: "Neuer Titel" }, new Date("2026-10-18T08:00:00.000Z"));
  assert.equal(first.match(/UID:.*/)?.[0], later.match(/UID:.*/)?.[0]);
  const long = icsFor({ ...item, description: "ä".repeat(200) });
  for (const line of long.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(fold("a".repeat(80)), `${"a".repeat(75)}\r\n ${"a".repeat(5)}`);
});

test("subscribe and template links", () => {
  const urls = subscribeUrls("https://meeqo.onrender.com", "/cal/abc.ics");
  assert.equal(urls.webcal, "webcal://meeqo.onrender.com/cal/abc.ics");
  assert.equal(urls.google, "https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fmeeqo.onrender.com%2Fcal%2Fabc.ics");
  const google = new URL(googleTemplateUrl({ ...item, url: "https://meeqo.onrender.com/activity/a1" }));
  assert.equal(google.searchParams.get("dates"), "20261018T100000Z/20261018T120000Z");
  assert.equal(google.searchParams.get("ctz"), "Europe/Berlin");
});
