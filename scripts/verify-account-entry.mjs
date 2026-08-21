import { chromium } from "playwright";

const baseUrl = process.env.PDF_EDITOR_URL || "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

async function assertIntent(buttonName, expectedIntent) {
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    await page.waitForURL(url => url.hostname !== new URL(baseUrl).hostname, { timeout: 12_000 });
    const currentUrl = new URL(page.url());
    if (currentUrl.searchParams.get("type") !== expectedIntent) {
      throw new Error(`${buttonName} launched ${currentUrl.searchParams.get("type") || "no intent"}, not ${expectedIntent}.`);
    }
  } finally {
    await browser.close();
  }
}

await assertIntent("Create account", "signUp");
await assertIntent("Sign in", "signIn");

const gateBrowser = await chromium.launch({ headless: true, executablePath });
const gatePage = await gateBrowser.newPage({ viewport: { width: 1280, height: 820 } });
try {
  await gatePage.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await gatePage.getByRole("button", { name: "Create account", exact: true }).waitFor();
  await gatePage.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  await gatePage.goto(`${baseUrl}/profile`, { waitUntil: "networkidle" });
  await gatePage.getByRole("button", { name: "Create account", exact: true }).waitFor();
  await gatePage.getByRole("button", { name: "Sign in", exact: true }).waitFor();
} finally {
  await gateBrowser.close();
}
console.log("Account entry verification passed: create-account and sign-in buttons use distinct secure intents.");
