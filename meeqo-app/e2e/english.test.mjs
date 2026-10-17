// English UI: signs up with an English browser, walks the main screens and fails on untranslated or German texts.
// Voraussetzung wie smoke.test.mjs. Start: node --test e2e/english.test.mjs
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { base, jpeg, launch, text } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

const GERMAN = /\b(und|nicht|oder|mit|für|deine?|dein|ein|eine|wir|ich|bitte|zurück|weiter|noch|keine?|gerade|alle)\b/i;

async function missing(page) {
  return page.evaluate(() => window.__i18nMissing ?? []);
}

describe("English", () => {
  test("sign-up and main screens show English only", async () => {
    const context = await browser.newContext({ locale: "en-GB", viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const seen = {};
    const visit = async (path) => {
      await page.goto(`${base}${path}`);
      await page.waitForTimeout(2200);
      seen[path] = { body: await text(page), missing: await missing(page) };
    };

    await page.goto(`${base}/login`);
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
    await page.getByPlaceholder("What you're called").fill("Eve");
    await page.getByPlaceholder("you@mail.com").fill(`eve${Date.now()}@test.de`);
    await page.getByPlaceholder(/At least 8/).fill("passwort123");
    await page.locator("form button[type=submit]").click();
    await page.waitForSelector("text=/year of birth/i", { timeout: 30000 });
    seen["/alter"] = { body: await text(page), missing: await missing(page) };
    await page.getByPlaceholder("1994").fill("1992");
    await page.getByLabel(/at least 18/i).check();
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForURL(`${base}/onboarding`, { timeout: 20000 });
    await page.waitForTimeout(1200);
    seen["/onboarding"] = { body: await text(page), missing: await missing(page) };
    await page.getByRole("button", { name: /^Friends/ }).first().click();
    await page.getByPlaceholder(/Postcode|postal/i).fill("Karlsruhe");
    await page.getByRole("button", { name: "On to the feed" }).click();
    await page.waitForURL(`${base}/`, { timeout: 20000 });

    for (const path of ["/", "/create", "/calendar", "/chat", "/profile", "/settings", "/search", "/categories", "/my-activities", "/notifications", "/friends", "/communities", "/support", "/requests"]) await visit(path);

    // The language switch brings German back.
    await page.goto(`${base}/settings`);
    await page.getByRole("button", { name: "Deutsch" }).click();
    await page.waitForTimeout(500);
    assert.match(await text(page), /Einstellungen/);

    const problems = [];
    for (const [path, { body, missing: gaps }] of Object.entries(seen)) {
      if (gaps.length) problems.push(`${path}: missing ${JSON.stringify(gaps)}`);
      const lines = body.split("\n").filter((line) => GERMAN.test(line));
      if (lines.length) problems.push(`${path}: German ${JSON.stringify(lines.slice(0, 6))}`);
    }
    assert.deepEqual(problems, []);
    await context.close();
  });
});
