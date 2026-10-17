import assert from "node:assert/strict";
import { test } from "node:test";
import { fitOf } from "./fit.ts";

const base = { friendsGoing: 0, matchesInterest: false, km: 40, hoursAway: 200, hostVerified: false, spotsLeft: 3 };

test("friends going beat everything else and are named as the reason", () => {
  const withFriends = fitOf({ ...base, friendsGoing: 2 });
  const nearOnly = fitOf({ ...base, km: 1 });
  assert.ok(withFriends.score > nearOnly.score);
  assert.match(withFriends.reason, /Freunde dabei/);
});

test("a full meetup sinks below an otherwise equal open one", () => {
  assert.ok(fitOf({ ...base, spotsLeft: 0 }).score < fitOf(base).score);
});

test("the reason names at most two things, strongest first", () => {
  const result = fitOf({ ...base, friendsGoing: 1, matchesInterest: true, km: 2, hoursAway: 5 });
  assert.equal(result.reason.split(" · ").length, 2);
  assert.match(result.reason, /^Freunde dabei/);
});

test("nothing special gives an empty reason instead of an invented one", () => {
  assert.equal(fitOf(base).reason, "");
});
