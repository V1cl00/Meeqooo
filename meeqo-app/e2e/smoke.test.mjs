// Echte Durchlaeufe im Browser. Voraussetzung: Dev-Server auf BASE_URL (Standard http://localhost:8080),
// gestartet mit ADMIN_EMAILS=admin@test.de. Start: npm run test:e2e
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { addPhoto, base, jpeg, launch, newUser, text } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

describe("Alter und Konto", () => {
  test("ohne Altersbestaetigung kommt man nicht in die App", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    await page.getByPlaceholder("Wie du heißt").fill("Jung");
    await page.getByPlaceholder("du@mail.de").fill(`jung${Date.now()}@test.de`);
    await page.getByPlaceholder("Mindestens 8 Zeichen").fill("passwort123");
    await page.locator("form button[type=submit]").click();
    await page.waitForSelector("text=Geburtsjahr", { timeout: 30000 });
    await page.getByPlaceholder("1994").fill("2015");
    await page.getByLabel("Ich bin mindestens 18 Jahre alt.").check();
    await page.getByLabel(/Ich stimme den/).check();
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.waitForTimeout(1500);
    assert.match(await text(page), /noch nicht 18/);
    await page.goto(`${base}/`);
    await page.waitForTimeout(2000);
    assert.match(page.url(), /\/alter$/);
    await context.close();
  });
});

describe("Kleinanzeigen", () => {
  test("Interesse melden braucht Foto, fuehrt in den Chat, Anbieter sieht ihn", async () => {
    const anna = await newUser(browser, "Anna");
    await anna.page.goto(`${base}/`);
    await anna.page.getByRole("button", { name: "Kleinanzeigen" }).click();
    await anna.page.getByRole("button", { name: "Anzeige aufgeben" }).click();
    await anna.page.locator("form input").first().fill("Rennrad, Größe 56");
    await anna.page.getByRole("button", { name: "Verkaufen", exact: true }).first().click();
    await anna.page.getByRole("button", { name: "Veröffentlichen" }).click();
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Rennrad/);

    const ben = await newUser(browser, "Ben", { photo: false });
    await ben.page.goto(`${base}/`);
    await ben.page.getByRole("button", { name: "Kleinanzeigen" }).click();
    await ben.page.waitForTimeout(1500);
    const card = ben.page.locator("article", { hasText: "Rennrad" }).first();
    await card.getByRole("button", { name: "Interesse melden" }).click();
    await ben.page.waitForTimeout(1500);
    assert.match(await text(ben.page), /Ohne Foto kannst du nicht anfragen/);

    await addPhoto(ben.page);
    await ben.page.goto(`${base}/`);
    await ben.page.getByRole("button", { name: "Kleinanzeigen" }).click();
    await ben.page.waitForTimeout(1500);
    await ben.page.locator("article", { hasText: "Rennrad" }).first().getByRole("button", { name: "Interesse melden" }).click();
    await ben.page.waitForURL(/\/chat\/anzeige\//, { timeout: 15000 });
    await ben.page.getByRole("button", { name: "Bahnhof" }).click();
    await ben.page.waitForTimeout(1500);

    await anna.page.goto(`${base}/chat`);
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /ANZEIGE/);
    await anna.page.getByText("Ben", { exact: false }).first().click();
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Übergabe öffentlich/);

    // live: Ben schreibt, Anna sieht es ohne Neuladen
    await ben.page.getByPlaceholder("Nachricht").fill("Bin gleich da");
    await ben.page.getByRole("button", { name: "Senden" }).click();
    await anna.page.waitForFunction(() => document.body.innerText.includes("Bin gleich da"), null, { timeout: 15000 });
    await anna.context.close();
    await ben.context.close();
  });
});

describe("Treffen", () => {
  test("Anlegen, Anfragen mit Tempo, Zusage, Bestaetigung, Vertrauens- und Einladungslink, Melden, Blockieren, Loeschen", async () => {
    const anna = await newUser(browser, "Anna");
    await anna.page.goto(`${base}/create`);
    await anna.page.getByPlaceholder("Zum Beispiel: Laufen, acht Kilometer").fill("Lauftreff Schlossgarten");
    await anna.page.getByRole("button", { name: "Weiter" }).click();
    assert.match(await text(anna.page), /Ohne Foto wird nichts veröffentlicht/);
    await anna.page.locator("input[type=file]").setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Weiter" }).click();
    await anna.page.getByLabel("Ort", { exact: true }).fill("Schlossgarten");
    const when = new Date(Date.now() + 26 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    await anna.page.getByLabel("Beginn").fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T10:00`);
    await anna.page.getByRole("button", { name: "Weiter" }).click();
    assert.match(await text(anna.page), /Schritt 3 von 3/, "Schritt 3 darf nicht sofort veroeffentlichen");
    await anna.page.getByRole("button", { name: "Veröffentlichen" }).click();
    await anna.page.waitForURL(/\/activity\//, { timeout: 20000 });
    const url = anna.page.url();

    const ben = await newUser(browser, "Ben");
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Gespräch" }).click();
    await ben.page.getByRole("button", { name: "Anfragen" }).click();
    await ben.page.waitForTimeout(1500);

    await anna.page.goto(`${base}/requests`);
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Erwartet: Gespräch/);
    await anna.page.getByRole("button", { name: "Annehmen" }).click();
    await anna.page.waitForTimeout(1000);

    await ben.page.goto(url);
    await ben.page.waitForTimeout(1500);
    const bt = await text(ben.page);
    assert.match(bt, /Bist du morgen dabei\?/);
    assert.match(bt, /Wer noch dabei ist/);
    await ben.page.getByRole("button", { name: "Ja, ich komme" }).click();
    await ben.page.waitForTimeout(1200);
    assert.match(await text(ben.page), /Gut, bis dann/);

    // Vertrauensperson
    await ben.page.getByRole("button", { name: "Vertrauensperson informieren" }).click();
    await ben.page.evaluate(() => { window.open = (u) => { window.__opened = String(u); return null; }; });
    await ben.page.getByRole("button", { name: "WhatsApp" }).click();
    const opened = await ben.page.evaluate(() => window.__opened || "");
    const link = decodeURIComponent(opened.split("text=")[1] ?? "").match(/http\S+/)?.[0];
    assert.ok(link, "Link fuer die Vertrauensperson fehlt");
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pub = await guest.newPage();
    await pub.goto(link);
    await pub.waitForTimeout(2500);
    assert.match(await text(pub), /Noch nicht losgegangen/);
    await ben.page.goto(url);
    await ben.page.getByRole("button", { name: "Check-in" }).click();
    await ben.page.waitForTimeout(1500);
    await pub.reload();
    await pub.waitForTimeout(2000);
    assert.match(await text(pub), /Eingecheckt/);

    // Einladung
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1200);
    await ben.page.getByRole("button", { name: "Mit Link einladen" }).click();
    await ben.page.evaluate(() => { window.open = (u) => { window.__opened = String(u); return null; }; });
    await ben.page.getByRole("button", { name: "WhatsApp" }).click();
    const invite = decodeURIComponent((await ben.page.evaluate(() => window.__opened || "")).split("text=")[1] ?? "").match(/http\S+/)?.[0];
    await pub.goto(invite);
    await pub.waitForTimeout(2000);
    assert.match(await text(pub), /Anna lädt dich ein/);

    // Serie
    await anna.page.goto(url);
    await anna.page.waitForTimeout(1200);
    await anna.page.locator("select[aria-label='Wie viele Wochen']").selectOption("4");
    await anna.page.getByRole("button", { name: "Als Serie anlegen" }).click();
    await anna.page.waitForTimeout(2500);
    await anna.page.goto(`${base}/my-activities`);
    await anna.page.waitForTimeout(1500);
    assert.equal(((await text(anna.page)).match(/Lauftreff Schlossgarten/g) || []).length, 5);

    // Melden, Blockieren, Loeschen
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1200);
    await ben.page.getByRole("button", { name: /Melden oder blockieren/ }).click();
    await ben.page.getByRole("button", { name: "Fake oder Betrug" }).click();
    await ben.page.getByRole("button", { name: "Melden", exact: true }).click();
    await ben.page.waitForTimeout(1200);
    assert.match(await text(ben.page), /Danke\. Wir sehen uns das an\./);
    await ben.page.getByRole("button", { name: /Melden oder blockieren/ }).click();
    await ben.page.getByRole("button", { name: /Anna blockieren/ }).click();
    await ben.page.waitForTimeout(2500);
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1500);
    assert.ok(!(await text(ben.page)).includes("Lauftreff Schlossgarten"));
    await ben.page.goto(`${base}/settings`);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByLabel("Tipp LÖSCHEN zur Bestätigung").fill("LÖSCHEN");
    await ben.page.getByRole("button", { name: "Konto endgültig löschen" }).click();
    await ben.page.waitForTimeout(4000);
    assert.match(ben.page.url(), /\/login/);
    await guest.close();
    await anna.context.close();
    await ben.context.close();
  });
});

describe("Moderation", () => {
  test("Admin sieht Meldungen, sperrt und entsperrt; Nicht-Admins sehen nichts", async () => {
    const anna = await newUser(browser, "Anna");
    const title = `Verdächtiges Angebot ${Date.now()}`;
    await anna.page.goto(`${base}/`);
    await anna.page.getByRole("button", { name: "Kleinanzeigen" }).click();
    await anna.page.getByRole("button", { name: "Anzeige aufgeben" }).click();
    await anna.page.locator("form input").first().fill(title);
    await anna.page.getByRole("button", { name: "Verkaufen", exact: true }).first().click();
    await anna.page.getByRole("button", { name: "Veröffentlichen" }).click();
    await anna.page.waitForTimeout(1500);

    const ben = await newUser(browser, "Ben");
    await ben.page.goto(`${base}/`);
    await ben.page.getByRole("button", { name: "Kleinanzeigen" }).click();
    await ben.page.waitForTimeout(1500);
    const card = ben.page.locator("article", { hasText: title });
    await card.getByRole("button", { name: /Melden oder blockieren/ }).click();
    await card.getByRole("button", { name: "Fake oder Betrug" }).click();
    await card.getByRole("button", { name: "Melden", exact: true }).click();
    await ben.page.waitForTimeout(1200);
    await ben.page.goto(`${base}/admin/meldungen`);
    await ben.page.waitForTimeout(1500);
    assert.match(await text(ben.page), /Nicht gefunden/);

    const admin = await newUser(browser, "Admin", { email: "admin@test.de", photo: false }).catch(async () => {
      // Konto gibt es schon von einem frueheren Lauf: einloggen
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(`${base}/login`);
      await page.getByRole("button", { name: "Einloggen" }).first().click();
      await page.getByPlaceholder("du@mail.de").fill("admin@test.de");
      await page.getByPlaceholder("Mindestens 8 Zeichen").fill("passwort123");
      await page.locator("form button[type=submit]").click();
      await page.waitForTimeout(3000);
      return { context, page };
    });
    await admin.page.goto(`${base}/admin/meldungen`);
    await admin.page.waitForTimeout(1500);
    assert.ok((await text(admin.page)).includes(title));
    const report = admin.page.locator("article", { hasText: title });
    await report.getByRole("button", { name: "Konto sperren" }).click();
    await admin.page.waitForTimeout(1500);
    await anna.page.goto(`${base}/`);
    await anna.page.waitForTimeout(2500);
    assert.match(await text(anna.page), /Dein Konto ist gesperrt/);
    await admin.page.getByRole("button", { name: "Alle" }).click();
    await admin.page.locator("article", { hasText: title }).getByRole("button", { name: "Entsperren" }).click();
    await admin.page.waitForTimeout(1200);
    await anna.page.goto(`${base}/`);
    await anna.page.waitForTimeout(2500);
    assert.match(await text(anna.page), /Treffen in der Nähe/);

    await admin.page.goto(`${base}/admin/zahlen`);
    await admin.page.waitForTimeout(1500);
    assert.match(await text(admin.page), /Unbeantwortet/);
    await anna.context.close();
    await ben.context.close();
    await admin.context.close();
  });
});
