import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinHour, channelsFor, inQuiet, NOTIFY_TYPES, typeOfKind } from "./notify-prefs.ts";

const quiet = { on: true, from: 22, to: 8 };
const day = { emailOn: true, quiet, hour: 14 };

test("Jede Art folgt ihrem eigenen Schalter, Push und E-Mail getrennt", () => {
  for (const type of NOTIFY_TYPES) {
    const kind = type.kinds[0];
    assert.equal(channelsFor(kind, {}, day).push, type.push, `${type.key} Standard Push`);
    assert.equal(channelsFor(kind, {}, day).email, Boolean(type.email), `${type.key} Standard E-Mail`);
    assert.equal(channelsFor(kind, { [type.key]: { push: false } }, day).push, false, `${type.key} Push aus`);
    assert.equal(channelsFor(kind, { [type.key]: { email: false } }, day).email, false, `${type.key} E-Mail aus`);
    if (type.email !== null) assert.equal(channelsFor(kind, { [type.key]: { email: true } }, day).email, true, `${type.key} E-Mail an`);
    else assert.equal(channelsFor(kind, { [type.key]: { email: true } }, day).email, false, `${type.key} hat keine E-Mail`);
  }
});

test("E-Mail-Hauptschalter aus: keine Mails", () => {
  assert.equal(channelsFor("request", {}, { ...day, emailOn: false }).email, false);
});

test("Ruhezeiten halten Push zurück, nicht Mails und nicht dringende Änderungen", () => {
  const night = { ...day, hour: 23 };
  assert.equal(channelsFor("request", {}, night).push, false);
  assert.equal(channelsFor("request", {}, night).email, true);
  assert.equal(channelsFor("cancelled", {}, night).push, true);
  assert.equal(channelsFor("changed", {}, { ...day, hour: 6 }).push, true);
  assert.equal(channelsFor("message", {}, { ...day, hour: 7 }).push, false);
  assert.equal(channelsFor("message", {}, { ...day, hour: 8 }).push, true);
  assert.equal(channelsFor("message", {}, { ...night, quiet: { ...quiet, on: false } }).push, true);
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
