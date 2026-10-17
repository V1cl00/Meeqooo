// Startgebiet Karlsruhe + 100 km: wer weiter weg wohnt, sieht den Hinweis. Voraussetzung wie smoke.test.mjs.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { base, launch, newUser, text } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

describe("Startgebiet", () => {
  test("Berlin sieht den Hinweis, Heidelberg nicht", async () => {
    const far = await newUser(browser, "Bernd", { city: "Berlin" });
    await far.page.goto(`${base}/`);
    await far.page.waitForFunction(() => /MeeQo startet im Raum Karlsruhe/.test(document.body.innerText), null, { timeout: 15000 });
    await far.context.close();

    const near = await newUser(browser, "Heidi", { city: "Heidelberg" });
    await near.page.goto(`${base}/`);
    await near.page.waitForTimeout(3000);
    assert.doesNotMatch(await text(near.page), /MeeQo startet im Raum/);
    await near.context.close();
  });
});
