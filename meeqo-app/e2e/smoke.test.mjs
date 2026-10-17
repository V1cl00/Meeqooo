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

async function createMeetup(page, title, hoursAhead, { spots } = {}) {
  await page.goto(`${base}/create`);
  await page.getByPlaceholder("Zum Beispiel: Laufen, acht Kilometer").fill(title);
  await page.getByRole("button", { name: "Weiter" }).click();
  assert.match(await text(page), /Ohne Foto wird nichts veröffentlicht/);
  await page.locator("input[type=file]").setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByLabel("Ort", { exact: true }).fill("Schlossgarten");
  const when = new Date(Date.now() + hoursAhead * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  await page.getByLabel("Beginn").fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`);
  if (spots) await page.getByLabel("Plätze für Gäste").fill(String(spots));
  await page.getByRole("button", { name: "Weiter" }).click();
  assert.match(await text(page), /Schritt 3 von 3/, "Schritt 3 darf nicht sofort veroeffentlichen");
  await page.getByRole("button", { name: "Veröffentlichen" }).click();
  await page.waitForURL(/\/activity\//, { timeout: 20000 });
  return page.url();
}

async function shareLink(page) {
  await page.evaluate(() => { window.open = (u) => { window.__opened = String(u); return null; }; });
  await page.getByRole("button", { name: "WhatsApp" }).click();
  const opened = await page.evaluate(() => window.__opened || "");
  return decodeURIComponent(opened.split("text=")[1] ?? "").match(/http\S+/)?.[0];
}

describe("Treffen", () => {
  test("Anlegen, Anfragen mit Tempo, Zusage, Bestaetigung, Check-in-Fenster, Vertrauens- und Einladungslink, Serie, Ungelesen, Daten, Melden, Blockieren, Loeschen", async () => {
    const anna = await newUser(browser, "Anna");
    const url = await createMeetup(anna.page, "Lauftreff Schlossgarten", 26);
    const soon = await createMeetup(anna.page, "Frühtreff Schlossgarten", 1);

    const ben = await newUser(browser, "Ben");
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Gespräch" }).click();
    await ben.page.getByRole("button", { name: "Anfragen" }).click();
    await ben.page.waitForTimeout(1500);
    await ben.page.goto(soon);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Anfragen" }).click();
    await ben.page.waitForTimeout(1500);

    await anna.page.goto(`${base}/requests`);
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Erwartet: Gespräch/);
    assert.match(await text(anna.page), /Noch kein Treffen über MeeQo/);
    while (await anna.page.getByRole("button", { name: "Annehmen" }).count()) {
      await anna.page.getByRole("button", { name: "Annehmen" }).first().click();
      await anna.page.waitForTimeout(900);
    }

    // Bestaetigung am Vortag und zu frueher Check-in
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1500);
    const bt = await text(ben.page);
    assert.match(bt, /Bist du morgen dabei\?/);
    assert.match(bt, /Wer noch dabei ist/);
    await ben.page.getByRole("button", { name: "Ja, ich komme" }).click();
    await ben.page.waitForTimeout(1200);
    assert.match(await text(ben.page), /Gut, bis dann/);
    await ben.page.getByRole("button", { name: "Check-in" }).click();
    await ben.page.waitForTimeout(1200);
    assert.match(await text(ben.page), /Einchecken geht ab zwei Stunden vor Beginn/);

    // Vertrauensperson und Check-in kurz vor Beginn
    await ben.page.goto(soon);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Vertrauensperson informieren" }).click();
    const link = await shareLink(ben.page);
    assert.ok(link, "Link fuer die Vertrauensperson fehlt");
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pub = await guest.newPage();
    await pub.goto(link);
    await pub.waitForTimeout(2500);
    assert.match(await text(pub), /Noch nicht losgegangen/);
    await ben.page.goto(soon);
    await ben.page.getByRole("button", { name: "Check-in" }).click();
    await ben.page.waitForTimeout(1500);
    await pub.reload();
    await pub.waitForTimeout(2000);
    assert.match(await text(pub), /Eingecheckt/);
    await ben.page.getByRole("button", { name: "Gut angekommen" }).click();
    await ben.page.waitForTimeout(1500);
    await pub.reload();
    await pub.waitForTimeout(2000);
    assert.match(await text(pub), /Alles gut/);

    // Einladung mit Link-Vorschau
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1200);
    await ben.page.getByRole("button", { name: "Mit Link einladen" }).click();
    const invite = await shareLink(ben.page);
    const html = await (await pub.request.get(invite)).text();
    assert.match(html, /og:title/, "Einladung braucht eine Vorschau fuer WhatsApp");
    assert.match(html, /Anna lädt dich ein|Anna l&#228;dt dich ein|lädt dich ein: Lauftreff/);
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

    // Ungelesen
    const id = url.split("/").pop();
    await ben.page.goto(`${base}/chat/${id}`);
    await ben.page.getByPlaceholder("Nachricht").fill("Bin pünktlich da");
    await ben.page.getByRole("button", { name: "Senden" }).click();
    await ben.page.waitForTimeout(1500);
    await anna.page.goto(`${base}/chat`);
    await anna.page.waitForTimeout(2000);
    assert.ok(await anna.page.getByRole("img", { name: "Ungelesen" }).count(), "ungelesener Chat braucht einen Punkt");
    await anna.page.goto(`${base}/chat/${id}`);
    await anna.page.waitForTimeout(1500);
    await anna.page.goto(`${base}/chat`);
    await anna.page.waitForTimeout(2000);
    assert.equal(await anna.page.getByRole("img", { name: "Ungelesen" }).count(), 0, "nach dem Lesen ist der Punkt weg");

    // Daten herunterladen
    await ben.page.goto(`${base}/settings`);
    await ben.page.waitForTimeout(1500);
    const [download] = await Promise.all([ben.page.waitForEvent("download"), ben.page.getByRole("button", { name: "Daten herunterladen" }).click()]);
    const stream = await download.createReadStream();
    let raw = "";
    for await (const chunk of stream) raw += chunk;
    assert.ok(JSON.parse(raw).konto?.email, "Datei enthaelt das Konto");

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

describe("Bedienung", () => {
  test("Satz-Formular, Vorlage, Als Naechstes, Gleich, Karten-Menue, Schnell-Antworten, Abstimmung, Mitfahren, Kalender-Abo", async () => {
    const anna = await newUser(browser, "Anna");
    const tag = Date.now();

    // Ein Satz fuellt das Formular, eine Vorlage setzt Plaetze und Dauer
    await anna.page.goto(`${base}/create`);
    await anna.page.getByPlaceholder("Samstag 10 Uhr Bouldern am Ostkreuz, sechs Leute").fill("Morgen 18:30 Brunch bei Giulia für 4");
    await anna.page.getByRole("button", { name: "Ausfüllen" }).click();
    assert.match(await text(anna.page), /Ausgefüllt: .*Titel/);
    assert.equal(await anna.page.getByPlaceholder("Zum Beispiel: Laufen, acht Kilometer").inputValue(), "Brunch bei Giulia");
    assert.ok(await anna.page.getByRole("button", { name: /Vorlage einsetzen/ }).count(), "Vorlage fuer Brunch fehlt");
    await anna.page.getByRole("button", { name: /Vorlage einsetzen/ }).click();
    await anna.page.locator("input[type=file]").setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Weiter" }).click();
    assert.equal(await anna.page.getByLabel("Ort", { exact: true }).inputValue(), "Giulia");
    await anna.page.getByRole("button", { name: "Weiter" }).click();
    await anna.page.getByRole("button", { name: "Veröffentlichen" }).click();
    await anna.page.waitForURL(/\/activity\//, { timeout: 20000 });
    await anna.page.waitForFunction(() => /Plätzen frei/.test(document.body.innerText), null, { timeout: 15000 });
    assert.match(await text(anna.page), /120 Min\./);

    // Als Naechstes: ein Treffen in einer Stunde steht ganz oben, Einchecken und Gut angekommen
    const soon = await createMeetup(anna.page, `Eiltreff ${tag}`, 1);
    await anna.page.goto(`${base}/`);
    await anna.page.waitForTimeout(2500);
    assert.match(await text(anna.page), /als nächstes/i);
    assert.ok((await anna.page.locator("section[aria-label='Als Nächstes']").innerText()).includes(`Eiltreff ${tag}`));
    await anna.page.getByRole("button", { name: "Einchecken" }).click();
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Gut angekommen" }).click();
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Du hast Bescheid gesagt/);

    // Gleich in der Naehe und das Karten-Menue
    const ben = await newUser(browser, "Ben");
    await ben.page.goto(`${base}/`);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Gleich in der Nähe" }).click();
    await ben.page.waitForTimeout(1800);
    const card = ben.page.locator("article", { hasText: `Eiltreff ${tag}` });
    assert.ok(await card.count(), "Gleich zeigt das Treffen in einer Stunde");
    await card.getByRole("button", { name: "Mehr zu diesem Treffen" }).click();
    await ben.page.getByRole("button", { name: "Sport", exact: true }).click();
    await ben.page.getByRole("dialog").getByRole("button", { name: "Anfragen" }).click();
    await ben.page.waitForTimeout(1500);
    assert.match(await text(ben.page), /Anfrage ist raus/);
    await anna.page.goto(`${base}/requests`);
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Erwartet: Sport/);
    await anna.page.getByRole("button", { name: "Annehmen" }).first().click();
    await anna.page.waitForTimeout(1200);

    // Schnell-Antworten am Tag des Treffens, live bei Anna
    const id = soon.split("/").pop();
    await anna.page.goto(`${base}/chat/${id}`);
    await anna.page.waitForTimeout(1500);
    await ben.page.goto(`${base}/chat/${id}`);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Bin unterwegs" }).click();
    await anna.page.waitForFunction(() => document.body.innerText.includes("Bin unterwegs"), null, { timeout: 15000 });

    // Mitfahren
    await anna.page.goto(soon);
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Ich nehme jemanden mit" }).click();
    await anna.page.getByRole("button", { name: "Fahrt anbieten" }).click();
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Du fährst/);
    await ben.page.goto(soon);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Mitfahren", exact: true }).click();
    await ben.page.waitForTimeout(1500);
    assert.match(await text(ben.page), /Nicht mehr mitfahren/);
    await anna.page.reload();
    await anna.page.waitForTimeout(1800);
    assert.match(await text(anna.page), /mit Ben/);

    // Kalender-Abo
    await ben.page.goto(`${base}/settings`);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Link anzeigen" }).click();
    const feed = await ben.page.getByLabel("Kalender-Adresse").inputValue();
    const calendar = await (await ben.page.request.get(feed)).text();
    assert.match(calendar, /BEGIN:VCALENDAR/);
    assert.ok(calendar.includes(`Eiltreff ${tag}`));

    // Terminabstimmung: Ben fragt, Anna stimmt ab und legt fest
    await ben.page.goto(`${base}/chat/${id}`);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Termin abstimmen" }).click();
    const pad = (n) => String(n).padStart(2, "0");
    const slot = (days) => {
      const d = new Date(Date.now() + days * 86400000);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
    };
    await ben.page.getByLabel("Zeit 1").fill(slot(3));
    await ben.page.getByLabel("Zeit 2").fill(slot(4));
    await ben.page.getByRole("button", { name: "Abstimmen lassen" }).click();
    await anna.page.goto(`${base}/chat/${id}`);
    await anna.page.waitForFunction(() => document.body.innerText.includes("Wann passt es euch?"), null, { timeout: 15000 });
    await anna.page.locator("section[aria-label='Wann passt es euch?'] button[aria-pressed]").first().click();
    await anna.page.waitForTimeout(1200);
    await anna.page.getByRole("button", { name: "Festlegen" }).first().click();
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /Beendet/);
    await anna.context.close();
    await ben.context.close();
  });
});

describe("Grundlagen", () => {
  test("Warteliste, Nachruecken, Absagen, Bearbeiten, Entfernen, Ansage, Sortierung", async () => {
    const tag = Date.now();
    const anna = await newUser(browser, "Anna");
    const url = await createMeetup(anna.page, `Kleinrunde ${tag}`, 40, { spots: 1 });
    const id = url.split("/").pop();

    const ben = await newUser(browser, "Ben");
    const cleo = await newUser(browser, "Cleo");
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Anfragen" }).click();
    await ben.page.waitForTimeout(1200);
    await anna.page.goto(`${base}/requests`);
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Annehmen" }).first().click();
    await anna.page.waitForTimeout(1200);

    // voll: Cleo kommt auf die Warteliste
    await cleo.page.goto(url);
    await cleo.page.waitForTimeout(1500);
    assert.ok(await cleo.page.getByRole("button", { name: "Auf die Warteliste" }).count(), "bei vollem Treffen steht Warteliste");
    await cleo.page.getByRole("button", { name: "Auf die Warteliste" }).click();
    await cleo.page.waitForTimeout(1500);
    assert.match(await text(cleo.page), /Warteliste, Platz 1/);
    await anna.page.goto(url);
    await anna.page.waitForTimeout(1500);
    assert.match(await text(anna.page), /1 Person wartet/);

    // Ben sagt ab, Cleo rueckt nach und landet bei Anna zur Freigabe
    await ben.page.goto(url);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Absagen" }).click();
    await ben.page.getByRole("button", { name: "Ja, ich sage ab" }).click();
    await ben.page.waitForTimeout(1500);
    await cleo.page.goto(url);
    await cleo.page.waitForTimeout(1500);
    assert.match(await text(cleo.page), /Wartet auf Freigabe/);
    await anna.page.goto(`${base}/requests`);
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Annehmen" }).first().click();
    await anna.page.waitForTimeout(1200);

    // Anna aendert Titel und Plaetze
    await anna.page.goto(`${base}/bearbeiten/${id}`);
    await anna.page.waitForFunction(() => document.querySelector("input")?.value, null, { timeout: 15000 });
    await anna.page.getByLabel("Titel").fill(`Kleinrunde ${tag} neu`);
    await anna.page.getByLabel("Plätze für Gäste").fill("3");
    await anna.page.getByRole("button", { name: "Speichern" }).click();
    await anna.page.waitForFunction(() => /Plätzen frei/.test(document.body.innerText), null, { timeout: 15000 });
    assert.match(await text(anna.page), new RegExp(`Kleinrunde ${tag} neu`));
    assert.match(await text(anna.page), /von 3 Plätzen/);

    // Ansage an alle, live bei Cleo
    await cleo.page.goto(`${base}/chat/${id}`);
    await cleo.page.waitForTimeout(1500);
    await anna.page.goto(`${base}/chat/${id}`);
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Ansage an alle" }).click();
    await anna.page.getByPlaceholder("Ansage an alle").fill("Wir treffen uns am Eingang");
    await anna.page.getByRole("button", { name: "Ansage senden" }).click();
    await cleo.page.waitForFunction(() => document.body.innerText.includes("Ansage: Wir treffen uns am Eingang"), null, { timeout: 15000 });

    // Anna nimmt Cleo heraus: kann nicht erneut anfragen
    await anna.page.goto(url);
    await anna.page.waitForTimeout(1500);
    await anna.page.getByRole("button", { name: "Entfernen" }).click();
    await anna.page.getByRole("button", { name: "Wirklich?" }).click();
    await anna.page.waitForTimeout(1500);
    await cleo.page.goto(url);
    await cleo.page.waitForTimeout(1500);
    await cleo.page.getByRole("button", { name: "Anfragen" }).click();
    await cleo.page.waitForTimeout(1500);
    assert.match(await text(cleo.page), /aus diesem Treffen genommen/);

    // Sortierung nach Passung
    await ben.page.goto(`${base}/`);
    await ben.page.waitForTimeout(1500);
    await ben.page.getByRole("button", { name: "Passend für dich" }).click();
    await ben.page.waitForTimeout(1800);
    assert.equal(await ben.page.getByRole("button", { name: "Passend für dich" }).getAttribute("aria-pressed"), "true");
    const sorted = await text(ben.page);
    assert.ok((await ben.page.locator("article").count()) > 0 || /nichts|Das ändern wir/.test(sorted), "sortierter Feed lädt ohne Fehler");
    assert.ok(!/Unauthorized|Fehler/.test(sorted));
    await anna.context.close();
    await ben.context.close();
    await cleo.context.close();
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
