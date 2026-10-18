import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmAction } from "./attendance.ts";

const now = new Date("2026-10-16T10:00:00.000Z");
const in_ = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

test("far away or already confirmed: nothing happens", () => {
  assert.equal(confirmAction({ startsAt: in_(30), now, confirmed: false, askedAt: null, waitlist: 3 }), "none");
  assert.equal(confirmAction({ startsAt: in_(5), now, confirmed: true, askedAt: ago(600), waitlist: 3 }), "none");
});

test("the question comes once, within a day of the start", () => {
  assert.equal(confirmAction({ startsAt: in_(20), now, confirmed: false, askedAt: null, waitlist: 0 }), "ask");
  assert.equal(confirmAction({ startsAt: in_(19), now, confirmed: false, askedAt: ago(30), waitlist: 0 }), "none");
});

test("the spot only goes when someone waits, the start is near and the guest had time to answer", () => {
  assert.equal(confirmAction({ startsAt: in_(2), now, confirmed: false, askedAt: ago(120), waitlist: 1 }), "release");
  assert.equal(confirmAction({ startsAt: in_(2), now, confirmed: false, askedAt: ago(120), waitlist: 0 }), "none");
  assert.equal(confirmAction({ startsAt: in_(2), now, confirmed: false, askedAt: ago(20), waitlist: 1 }), "none");
  assert.equal(confirmAction({ startsAt: in_(6), now, confirmed: false, askedAt: ago(600), waitlist: 1 }), "none");
});

test("a meetup that is about to begin is left alone", () => {
  assert.equal(confirmAction({ startsAt: in_(0.1), now, confirmed: false, askedAt: null, waitlist: 1 }), "none");
});
