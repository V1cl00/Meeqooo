// Startgebiet Karlsruhe + 100 km: wer weiter weg wohnt, sieht den Hinweis. Voraussetzung wie smoke.test.mjs.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminPage, base, launch, newUser, setAreas, text } from "./helpers.mjs";

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

  test("beim Start nur Freunde und Aktivitaeten, Zahlen zeigen den Weg", async () => {
    await setAreas(browser, { Dating: false, Business: false, Kleinanzeigen: false });
    const user = await newUser(browser, "Fritz");
    await user.page.goto(`${base}/`);
    await user.page.waitForTimeout(2500);
    const feed = await text(user.page);
    assert.doesNotMatch(feed, /^Dating$/m);
    assert.doesNotMatch(feed, /^Kleinanzeigen$/m);
    assert.match(feed, /Freunde/);
    await user.page.goto(`${base}/create`);
    await user.page.getByPlaceholder("Zum Beispiel: Laufen, acht Kilometer").fill("Spaziergang am Rhein");
    await user.page.getByRole("button", { name: "Weiter" }).click();
    await user.page.locator("input[type=file]").setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64") });
    await user.page.waitForTimeout(1500);
    await user.page.getByRole("button", { name: "Weiter" }).click();
    await user.page.getByLabel("Ort", { exact: true }).fill("Schlossgarten");
    await user.page.getByLabel("Beginn").fill("2030-01-01T10:00");
    await user.page.getByRole("button", { name: "Weiter" }).click();
    await user.page.waitForTimeout(800);
    const step3 = await text(user.page);
    assert.match(step3, /Nur Freundschaft/);
    assert.doesNotMatch(step3, /Nur Dates/);
    await user.context.close();

    const admin = await adminPage(browser);
    await admin.page.goto(`${base}/admin/zahlen`);
    await admin.page.waitForFunction(() => /Weg der letzten 30 Tage/.test(document.body.innerText), null, { timeout: 15000 });
    const stats = await text(admin.page);
    assert.match(stats, /Angemeldet/);
    assert.match(stats, /Heute aktiv/);
    await admin.context.close();
  });
});
