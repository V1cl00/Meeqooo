// Design-Runde: Ideenwand, Stimmung, Zeitsignal, Ortsseite. Voraussetzung wie smoke.test.mjs.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { base, jpeg, launch, newUser, text } from "./helpers.mjs";

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

  test("Abend-Rückblick: Foto ins Album, Danke-Liste, Nochmal treffen füllt das Formular", async () => {
    const host = await newUser(browser, "Hana");
    const p = host.page;
    await p.goto(`${base}/create`);
    await p.getByPlaceholder("Zum Beispiel: Laufen, acht Kilometer").fill("Kaffee Rückblick");
    await p.getByRole("button", { name: "Weiter" }).click();
    await p.locator("input[type=file]").setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "Weiter" }).click();
    await p.getByLabel("Ort", { exact: true }).fill("Gutenbergplatz");
    const when = new Date(Date.now() - 30 * 60_000);
    const pad = (n) => String(n).padStart(2, "0");
    await p.getByLabel("Beginn").fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`);
    await p.getByRole("button", { name: "Weiter" }).click();
    await p.getByRole("button", { name: "Veröffentlichen" }).click();
    await p.waitForURL(/\/activity\//, { timeout: 20000 });
    const actUrl = p.url();
    const guest = await newUser(browser, "Gil");
    await guest.page.goto(actUrl);
    await guest.page.waitForTimeout(1500);
    await guest.page.getByRole("button", { name: "Anfragen" }).click();
    await guest.page.waitForTimeout(1500);
    await p.goto(`${base}/requests`);
    await p.getByRole("button", { name: "Annehmen" }).first().click();
    await p.waitForTimeout(1200);
    await p.goto(actUrl.replace("/activity/", "/wie-wars/"));
    await p.getByRole("button", { name: "Ja, war da" }).click();
    await p.getByRole("button", { name: "Abschicken" }).click();
    await p.getByText("Euer Album").waitFor({ timeout: 15000 });
    await p.getByLabel("Foto fürs Album").setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await p.getByText("1 Foto. Nur für alle, die dabei waren.").waitFor({ timeout: 15000 });
    await p.getByRole("link", { name: "Nochmal treffen" }).click();
    await p.waitForURL(/\/create\?/, { timeout: 15000 });
    await p.waitForFunction(() => [...document.querySelectorAll("input")].some((el) => el.value === "Kaffee Rückblick"), null, { timeout: 15000 });
    await guest.context.close();
    await host.context.close();
  });
});
