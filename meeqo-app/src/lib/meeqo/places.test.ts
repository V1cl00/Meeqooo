import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { lookupPlace, plzChoices, plzPoint } from "./places.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(routes: Record<string, unknown>, calls: string[] = []) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const hit = Object.entries(routes).find(([part]) => url.includes(part));
    if (!hit) return new Response("nope", { status: 404 });
    return new Response(JSON.stringify(hit[1]), { status: 200 });
  }) as typeof fetch;
  return calls;
}

const karlsruhe = (code: string) => ({ postalCode: code, name: "Karlsruhe", federalState: { name: "Baden-Württemberg" } });

test("a full PLZ lists that PLZ and every other PLZ of the same city, one row each", async () => {
  mockFetch({
    "postalCode=76131": [karlsruhe("76131")],
    "name=Karlsruhe": [karlsruhe("76131"), karlsruhe("76133"), karlsruhe("76135")],
  });
  const rows = await plzChoices("76131");
  assert.deepEqual(rows.map((row) => `${row.postalCode} ${row.name}`), ["76131 Karlsruhe", "76133 Karlsruhe", "76135 Karlsruhe"]);
});

test("a place name lists its PLZ", async () => {
  mockFetch({ "name=Karls": [karlsruhe("76131"), karlsruhe("76133")] });
  const rows = await plzChoices("Karls");
  assert.equal(rows.length, 2);
});

test("fewer than five digits asks no one", async () => {
  const calls = mockFetch({});
  assert.deepEqual(await plzChoices("761"), []);
  assert.equal(calls.length, 0);
});

test("a network failure gives an empty list instead of throwing", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  assert.deepEqual(await plzChoices("76131"), []);
});

test("rows without a five digit PLZ are dropped", async () => {
  mockFetch({ "name=Dorf": [{ postalCode: "123", name: "Dorf" }, { postalCode: "01234", name: "Dorf" }] });
  const rows = await plzChoices("Dorf");
  assert.deepEqual(rows.map((row) => row.postalCode), ["01234"]);
});

test("zippopotam gives coordinates, a 404 gives null", async () => {
  mockFetch({ "zippopotam.us/de/76131": { places: [{ latitude: "49.0147", longitude: "8.4189" }] } });
  assert.deepEqual(await plzPoint("76131"), { lat: 49.0147, lng: 8.4189 });
  assert.equal(await plzPoint("00000"), null);
});

test("lookupPlace tries zippopotam for a PLZ and falls back to nominatim", async () => {
  const calls = mockFetch({ "nominatim.openstreetmap.org": [{ lat: "49.01", lon: "8.42" }] });
  const point = await lookupPlace("76999 Irgendwo");
  assert.deepEqual(point, { lat: 49.01, lng: 8.42 });
  assert.ok(calls[0]?.includes("zippopotam.us/de/76999"));
  assert.ok(calls.some((url) => url.includes("nominatim")));
});
