import { test } from "node:test";
import assert from "node:assert/strict";
import { linkShareData, shareRoute } from "./share-plan.ts";

test("Teilen schickt nur den Link, ohne Titel, Text oder Datei", () => {
  const data = linkShareData("https://meeqo.onrender.com/activity/a");
  assert.deepEqual(data, { url: "https://meeqo.onrender.com/activity/a" });
  assert.deepEqual(Object.keys(data), ["url"]);
});

test("Weg: App-Sheet, sonst Browser-Sheet, sonst eigenes Blatt", () => {
  assert.equal(shareRoute({ native: true, webShare: false }), "native");
  assert.equal(shareRoute({ native: true, webShare: true }), "native");
  assert.equal(shareRoute({ native: false, webShare: true }), "web");
  assert.equal(shareRoute({ native: false, webShare: false }), "sheet");
});
