import { chromium } from "playwright";

export const base = process.env.BASE_URL || "http://localhost:8080";

/** A 1x1 JPEG, enough for the photo checks. */
export const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

/** Contexts default to German, so the German texts the tests look for are what the app shows. Pass `locale: "en-GB"` for English. */
export async function launch() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const open = browser.newContext.bind(browser);
  browser.newContext = (options = {}) => open({ locale: "de-DE", ...options });
  return browser;
}

export async function text(page) {
  return page.locator("body").innerText();
}

/** Signs up a fresh account, confirms age, finishes onboarding. Pass `email` for a fixed address (the admin). */
export async function newUser(browser, name, { email, photo = true, scheme, city = "Karlsruhe" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(scheme ? { colorScheme: scheme } : {}) });
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByPlaceholder("Wie du heißt").fill(name);
  await page.getByPlaceholder("du@mail.de").fill(email || `${name.toLowerCase()}${Date.now()}${Math.floor(Math.random() * 1000)}@test.de`);
  await page.getByPlaceholder("Mindestens 8 Zeichen").fill("passwort123");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/(alter|onboarding)?$/, { timeout: 30000 });
  await page.waitForSelector("text=Geburtsjahr", { timeout: 30000 });
  await page.getByPlaceholder("1994").fill("1992");
  await page.getByLabel("Ich bin mindestens 18 Jahre alt.").check();
  await page.getByLabel(/Ich stimme den/).check();
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.waitForURL(`${base}/onboarding`, { timeout: 20000 });
  // Beim Start sind nur Freunde und Aktivitaeten an (Schalter in /admin/zahlen); die Bereichswahl entfaellt dann.
  await page.getByPlaceholder("Postleitzahl, Stadt oder Dorf").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  for (const title of ["Dating", "Freunde", "Business", "Kleinanzeigen"]) {
    const button = page.getByRole("button", { name: new RegExp(`^${title}`) }).first();
    if (await button.count()) await button.click();
  }
  await page.getByPlaceholder("Postleitzahl, Stadt oder Dorf").fill(city);
  await page.getByRole("button", { name: "Weiter zum Feed" }).click();
  await page.waitForURL(`${base}/`, { timeout: 20000 });
  if (photo) await addPhoto(page);
  return { context, page };
}

export async function addPhoto(page) {
  await page.goto(`${base}/profile`);
  await page.locator("input[type=file]").first().setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.waitForTimeout(2500);
}

/** Logs in as the admin (creating the account on a fresh database) and returns its page. */
export async function adminPage(browser) {
  const admin = await newUser(browser, "Admin", { email: "admin@test.de", photo: false }).catch(async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    await page.getByRole("button", { name: "Einloggen" }).first().click();
    await page.getByPlaceholder("du@mail.de").fill("admin@test.de");
    await page.getByPlaceholder("Mindestens 8 Zeichen").fill("passwort123");
    await page.locator("form button[type=submit]").click();
    await page.waitForTimeout(3000);
    if (page.url().includes("/onboarding")) {
      await page.getByPlaceholder("Postleitzahl, Stadt oder Dorf").fill("Karlsruhe");
      await page.getByRole("button", { name: "Weiter zum Feed" }).click();
      await page.waitForURL(`${base}/`, { timeout: 20000 });
    }
    return { context, page };
  });
  return admin;
}

/** Switches areas on or off through the admin page. `wanted` maps label to on/off, e.g. { Dating: true }. */
export async function setAreas(browser, wanted) {
  const admin = await adminPage(browser);
  await admin.page.goto(`${base}/admin/zahlen`);
  await admin.page.waitForSelector("text=Bereiche", { timeout: 20000 });
  for (const [label, on] of Object.entries(wanted)) {
    const toggle = admin.page.locator("label", { hasText: label }).getByRole("switch");
    if ((await toggle.isChecked()) !== on) {
      await toggle.click();
      await admin.page.waitForFunction(({ label, on }) => {
        const node = [...document.querySelectorAll("label")].find((item) => item.textContent?.includes(label))?.querySelector("input");
        return node?.checked === on;
      }, { label, on }, { timeout: 10000 });
    }
  }
  await admin.page.waitForTimeout(1000);
  await admin.context.close();
  await new Promise((resolve) => setTimeout(resolve, 500));
}
