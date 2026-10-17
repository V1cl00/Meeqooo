import { chromium } from "playwright";

export const base = process.env.BASE_URL || "http://localhost:8080";

/** A 1x1 JPEG, enough for the photo checks. */
export const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
}

export async function text(page) {
  return page.locator("body").innerText();
}

/** Signs up a fresh account, confirms age, finishes onboarding. Pass `email` for a fixed address (the admin). */
export async function newUser(browser, name, { email, photo = true, scheme } = {}) {
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
  for (const title of ["Dating", "Freunde", "Business", "Kleinanzeigen"]) {
    await page.getByRole("button", { name: new RegExp(`^${title}`) }).first().click();
  }
  await page.getByPlaceholder("Postleitzahl, Stadt oder Dorf").fill("Karlsruhe");
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
