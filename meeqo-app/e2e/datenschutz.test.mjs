// Sensible Angaben (Queer) nur mit Einwilligung, Widerruf loescht sie wieder. Voraussetzung wie smoke.test.mjs.
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

const chip = (page) => page.locator("div.card").filter({ hasText: "Das trifft auf mich zu" }).getByRole("button", { name: "Queer", exact: true });
const chipOn = (page) => chip(page).evaluate((node) => node.className.includes("bg-accent"));

describe("Sensible Angaben", () => {
  test("ohne Einwilligung nichts gespeichert, mit Einwilligung ja, Widerruf loescht", async () => {
    const { page, context } = await newUser(browser, "Quentin");
    await page.goto(`${base}/profile`);
    await page.waitForTimeout(1500);

    // Ablehnen: Angabe wird nicht gesetzt
    await chip(page).click();
    await page.waitForSelector("text=Besonders geschützte Angabe");
    await page.getByRole("button", { name: "Nicht jetzt" }).click();
    assert.equal(await chipOn(page), false);

    // Einwilligen: Angabe wird gesetzt und gespeichert
    await chip(page).click();
    await page.getByRole("button", { name: "Ich willige ein" }).click();
    await page.waitForFunction(() => !document.body.innerText.includes("Besonders geschützte Angabe"), null, { timeout: 10000 });
    assert.equal(await chipOn(page), true);
    await page.getByRole("button", { name: "Absicht speichern" }).click();
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForTimeout(1500);
    assert.equal(await chipOn(page), true);

    // Widerruf in den Einstellungen loescht die Angabe
    await page.goto(`${base}/settings`);
    await page.waitForSelector("text=Du hast eingewilligt.");
    await page.getByRole("button", { name: /Einwilligung widerrufen/ }).click();
    await page.waitForFunction(() => document.body.innerText.includes("Keine Einwilligung gegeben"), null, { timeout: 10000 });
    await page.goto(`${base}/profile`);
    await page.waitForTimeout(1500);
    assert.equal(await chipOn(page), false);
    assert.match(await text(page), /Das trifft auf mich zu/);
    await context.close();
  });
});
