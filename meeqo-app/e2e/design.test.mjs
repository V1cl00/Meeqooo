// Design-Runde: Ideenwand, Stimmung, Zeitsignal, Ortsseite. Voraussetzung wie smoke.test.mjs.
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

describe("Design", () => {
  test("Ideenwand: posten, Ich auch, daraus ein Treffen machen füllt das Formular", async () => {
    const idea = `Flohmarkt und Kaffee ${Date.now() % 10000}`;
    const a = await newUser(browser, "Ida");
    await a.page.goto(`${base}/ideen`);
    await a.page.getByLabel("Deine Idee").fill(idea);
    await a.page.getByRole("button", { name: "Posten" }).click();
    await a.page.getByText(idea).waitFor({ timeout: 15000 });

    const b = await newUser(browser, "Bo");
    await b.page.goto(`${base}/ideen`);
    const card = b.page.locator(".card", { hasText: idea });
    await card.waitFor({ timeout: 15000 });
    await card.getByRole("button", { name: /Ich auch · 1/ }).click();
    await card.getByRole("button", { name: /Ich auch · 2/ }).waitFor({ timeout: 15000 });
    await card.getByRole("link", { name: "Daraus ein Treffen machen" }).click();
    await b.page.waitForURL(/\/create\?/, { timeout: 15000 });
    await b.page.waitForFunction((value) => [...document.querySelectorAll("input")].some((el) => el.value === value), idea, { timeout: 15000 });
    await a.context.close();
    await b.context.close();
  });

  test("Feed: Stimmung, Zeitsignal nur für Freunde, Ortsseite ohne Partner-Anschein", async () => {
    const u = await newUser(browser, "Mo");
    await u.page.goto(`${base}/`);
    await u.page.getByRole("button", { name: "Aktiv", exact: true }).click();
    assert.equal(await u.page.getByRole("button", { name: "Aktiv", exact: true }).getAttribute("aria-pressed"), "true");
    await u.page.getByRole("button", { name: /Ich hab jetzt 2 Std Zeit/ }).click();
    await u.page.getByText(/Du hast Zeit bis/).waitFor({ timeout: 15000 });
    await u.page.getByRole("button", { name: /Du hast Zeit bis/ }).click();
    await u.page.getByText("Ich hab jetzt 2 Std Zeit").waitFor({ timeout: 15000 });

    await u.page.goto(`${base}/orte/venue-boulderhalle-steil`);
    await u.page.getByText("Boulderhalle Steil").first().waitFor({ timeout: 15000 });
    assert.match(await text(u.page), /kein Partner von MeeQo/);
    await u.context.close();
  });
});
