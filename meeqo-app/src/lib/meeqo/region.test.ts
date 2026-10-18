import assert from "node:assert/strict";
import { test } from "node:test";
import { cityCoords, matchCities } from "./geo.ts";
import { inLaunchRegion } from "./region.ts";

test("towns around Karlsruhe are inside, far cities are outside", () => {
  for (const town of ["Karlsruhe", "Heidelberg", "Stuttgart", "Heilbronn", "Speyer", "Offenburg", "Kaiserslautern", "Baden-Baden", "Pforzheim"]) {
    const point = cityCoords(town);
    assert.ok(point, `${town} is known`);
    assert.equal(inLaunchRegion(point.lat, point.lng), true, town);
  }
  for (const city of ["Berlin", "München", "Hamburg", "Köln", "Freiburg"]) {
    const point = cityCoords(city)!;
    assert.equal(inLaunchRegion(point.lat, point.lng), false, city);
  }
});

test("no position yet counts as inside, so nobody sees a warning too early", () => {
  assert.equal(inLaunchRegion(null, null), true);
});

test("the search suggests the launch region first", () => {
  assert.equal(matchCities("hei")[0]?.city, "Heidelberg");
  assert.ok(matchCities("spey").some((hit) => hit.city === "Speyer"));
});
