// Runde 3: schnelles Onboarding, Selfie-Prüfung durch Admin, Orte als Vorlagen, Mitteilungs-Schalter. Voraussetzung wie smoke.test.mjs.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { adminPage, base, jpeg, launch, newUser, text } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

describe("Runde 3", () => {
  test("Selfie geht in die Prüfung, Admin bestätigt, Profil zeigt Verifiziert, Selfie ist weg", async () => {
    const name = `Selma${Date.now() % 100000}`;
    const user = await newUser(browser, name);
    await user.page.goto(`${base}/profile`);
    await user.page.getByText("Selfie-Prüfung", { exact: true }).waitFor({ timeout: 15000 });
    await user.page.getByLabel("Selfie aufnehmen").setInputFiles({ name: "s.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await user.page.getByText("Wird geprüft").waitFor({ timeout: 15000 });

    const admin = await adminPage(browser);
    await admin.page.goto(`${base}/admin/pruefung`);
    const card = admin.page.locator(".card", { hasText: name });
    await card.waitFor({ timeout: 15000 });
    await card.getByRole("button", { name: "Passt", exact: true }).click();
    await admin.page.waitForFunction((who) => !document.body.innerText.includes(who), name, { timeout: 15000 });

    await user.page.goto(`${base}/profile`);
    await user.page.getByText("Verifiziert", { exact: true }).first().waitFor({ timeout: 15000 });
    await user.context.close();

    // Orte aus der Recherche füllen nur das Formular vor.
    await admin.page.goto(`${base}/admin/orte`);
    await admin.page.getByText("Boulderhalle Steil").waitFor({ timeout: 15000 });
    assert.match(await text(admin.page), /niemand wurde kontaktiert/);
    await admin.page.locator(".card", { hasText: "Boulderhalle Steil" }).getByRole("link", { name: "Als Treffen anlegen" }).click();
    await admin.page.waitForURL(/\/create\?/, { timeout: 15000 });
    await admin.page.waitForFunction(() => [...document.querySelectorAll("input")].some((el) => el.value.includes("Boulder")), null, { timeout: 15000 });
    await admin.context.close();
  });

  test("Mitteilungen lassen sich einzeln abschalten", async () => {
    const user = await newUser(browser, "Nora", { photo: false });
    await user.page.goto(`${base}/settings`);
    const reminder = user.page.getByRole("switch", { name: /Erinnerung 2 Stunden vorher/ });
    await reminder.waitFor({ timeout: 15000 });
    assert.equal(await reminder.isChecked(), true);
    await reminder.uncheck();
    await user.page.waitForTimeout(800);
    await user.page.reload();
    await user.page.getByRole("switch", { name: /Erinnerung 2 Stunden vorher/ }).waitFor({ timeout: 15000 });
    assert.equal(await user.page.getByRole("switch", { name: /Erinnerung 2 Stunden vorher/ }).isChecked(), false);
    await user.context.close();
  });
});
