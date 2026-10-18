import { test } from "node:test";
import assert from "node:assert/strict";
import { stillNeeded } from "./group-size.ts";

test("no minimum means nothing is missing", () => {
  assert.equal(stillNeeded(0, 0), 0);
  assert.equal(stillNeeded(1, 0), 0);
});

test("host counts as one person", () => {
  assert.equal(stillNeeded(4, 0), 3);
  assert.equal(stillNeeded(4, 2), 1);
  assert.equal(stillNeeded(4, 3), 0);
  assert.equal(stillNeeded(4, 9), 0);
});
