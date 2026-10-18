import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinHour, channelsFor, inQuiet, NOTIFY_TYPES, typeOfKind } from "./notify-prefs.ts";

const quiet = { on: true, from: 22, to: 8 };
const day = { quiet, hour: 14 };

test("Jede Art folgt ihrem eigenen Push-Schalter", () => {
  for (const type of NOTIFY_TYPES) {
    for (const kind of type.kinds) {
      assert.equal(channelsFor(kind, {}, day).push, type.push, `${type.key} Standard`);
      assert.equal(channelsFor(kind, { [type.key]: { push: false } }, day).push, false, `${type.key} aus`);
      assert.equal(channelsFor(kind, { [type.key]: { push: true } }, day).push, true, `${type.key} an`);
    }
  }
});

test("Keine Benachrichtigungs-Mails, auch nicht mit altem E-Mail-Wert", () => {
  for (const type of NOTIFY_TYPES) {
    assert.equal(channelsFor(type.kinds[0], { [type.key]: { email: true } }, day).email, false, type.key);
  }
  assert.equal(channelsFor("ad", {}, day).email, false);
  assert.equal(channelsFor("announce", {}, day).email, false);
});

test("Ruhezeiten halten Push zurück, nicht dringende Änderungen", () => {
  const night = { ...day, hour: 23 };
  assert.equal(channelsFor("request", {}, night).push, false);
  assert.equal(channelsFor("cancelled", {}, night).push, true);
  assert.equal(channelsFor("changed", {}, { ...day, hour: 6 }).push, true);
  assert.equal(channelsFor("cancelled", { change: { push: false } }, night).push, false);
  assert.equal(channelsFor("message", {}, { ...day, hour: 7 }).push, false);
  assert.equal(channelsFor("message", {}, { ...day, hour: 8 }).push, true);
  assert.equal(channelsFor("message", {}, { ...night, quiet: { ...quiet, on: false } }).push, true);
  assert.equal(channelsFor("friend", {}, night).push, false);
});

test("Ruhezeit über Mitternacht und Berliner Stunde", () => {
  assert.equal(inQuiet(22, quiet), true);
  assert.equal(inQuiet(3, quiet), true);
  assert.equal(inQuiet(8, quiet), false);
  assert.equal(inQuiet(13, { on: true, from: 12, to: 14 }), true);
  assert.equal(berlinHour(new Date("2026-10-18T20:30:00Z")), 22);
  assert.equal(berlinHour(new Date("2026-12-18T20:30:00Z")), 21);
  assert.equal(typeOfKind("accepted")?.key, "answer");
});
