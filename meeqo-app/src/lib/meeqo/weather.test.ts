import assert from "node:assert/strict";
import { test } from "node:test";
import { berlinHour, pickWeather } from "./weather.ts";

const hourly = {
  time: ["2026-10-17T18:00", "2026-10-17T19:00"],
  temperature_2m: [12.4, 11.6],
  precipitation_probability: [10, 80],
  weathercode: [1, 63],
};

test("the hour of the meetup is found in Berlin time, summer and winter", () => {
  assert.equal(berlinHour("2026-10-17T17:00:00Z"), "2026-10-17T19:00");
  assert.equal(berlinHour("2026-12-01T17:30:00Z"), "2026-12-01T18:00");
});

test("rain at an outdoor meetup comes with a hint, indoors it does not", () => {
  const outdoor = pickWeather(hourly, "2026-10-17T19:00", "Outdoor · Wandern");
  assert.equal(outdoor?.kind, "rain");
  assert.equal(outdoor?.temp, 12);
  assert.ok(outdoor?.hint);
  assert.equal(pickWeather(hourly, "2026-10-17T19:00", "Essen · Brunch")?.hint, "");
});

test("a fine evening has no hint, a missing hour gives nothing", () => {
  const fine = pickWeather(hourly, "2026-10-17T18:00", "Outdoor · Wandern");
  assert.equal(fine?.label, "Meist sonnig");
  assert.equal(fine?.hint, "");
  assert.equal(pickWeather(hourly, "2026-10-30T18:00", "Outdoor"), null);
});
