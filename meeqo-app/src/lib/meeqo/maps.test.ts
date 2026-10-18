import { test } from "node:test";
import assert from "node:assert/strict";
import { directionsUrl, mapsPlatform } from "./maps.ts";

const point = { lat: 49.001, lng: 8.411, label: "Werderplatz", address: "Werderplatz, Karlsruhe" };

test("Plattform: Capacitor zuerst, sonst User-Agent", () => {
  assert.equal(mapsPlatform("android", ""), "android");
  assert.equal(mapsPlatform("ios", "Android"), "ios");
  assert.equal(mapsPlatform("web", "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129 Mobile"), "android");
  assert.equal(mapsPlatform("web", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(mapsPlatform("web", "Mozilla/5.0 (X11; Linux x86_64) Chrome/129"), "desktop");
});

test("Wegbeschreibung mit Koordinaten", () => {
  assert.equal(directionsUrl(point, "android"), "https://www.google.com/maps/dir/?api=1&destination=49.001,8.411");
  assert.equal(directionsUrl(point, "android", true), "geo:49.001,8.411?q=49.001,8.411(Werderplatz)");
  assert.equal(directionsUrl(point, "ios"), "https://maps.apple.com/?daddr=49.001,8.411&q=Werderplatz");
  assert.equal(directionsUrl(point, "desktop"), "https://www.google.com/maps/dir/?api=1&destination=49.001,8.411");
});

test("Ohne Koordinaten: Adresse als Suche", () => {
  const place = { lat: null, lng: null, label: "Café X", address: "Kaiserstraße 1, Karlsruhe" };
  assert.equal(directionsUrl(place, "desktop"), "https://www.google.com/maps/dir/?api=1&destination=Kaiserstra%C3%9Fe%201%2C%20Karlsruhe");
  assert.equal(directionsUrl(place, "ios"), "https://maps.apple.com/?daddr=Kaiserstra%C3%9Fe%201%2C%20Karlsruhe");
  assert.equal(directionsUrl(place, "android", true), "geo:0,0?q=Kaiserstra%C3%9Fe%201%2C%20Karlsruhe");
});
