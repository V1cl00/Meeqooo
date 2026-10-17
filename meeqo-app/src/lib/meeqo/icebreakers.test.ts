import assert from "node:assert/strict";
import { test } from "node:test";
import { icebreakersFor } from "./icebreakers.ts";

test("the category decides, unknown ones fall back", () => {
  assert.match(icebreakersFor("Tiere · Gassi", "friends", 2)[0], /Hund/);
  assert.equal(icebreakersFor("Eigenes · Ding", "friends", 2).length, 3);
});

test("a one-to-one date asks how to recognise each other, a group greets", () => {
  assert.ok(icebreakersFor("Essen · Kaffee", "date", 2).some((line) => /erkenne/.test(line)));
  assert.match(icebreakersFor("Essen · Brunch", "friends", 6)[0], /zusammen/);
  assert.ok(icebreakersFor("Essen · Brunch", "friends", 6).length <= 4);
});
