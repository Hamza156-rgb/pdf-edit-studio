import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.PDF_EDITOR_URL || "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const outputDir = "/tmp/pdf-edit-studio-account";

async function verify(mode, triggerName, expectedHeading) {
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: triggerName, exact: true }).click();
    await page.waitForURL(new RegExp(`/account\\?mode=${mode}$`), { timeout: 10_000 });
    await page.getByRole("heading", { name: expectedHeading, exact: true }).waitFor();
    await page.getByLabel("Email").waitFor();
    const password = page.locator('input[autocomplete="new-password"], input[autocomplete="current-password"]');
    await password.waitFor();
    if (mode === "signup") await page.getByLabel("Name").waitFor();
    else if (await page.getByLabel("Name").count()) throw new Error("The login view unexpectedly includes a sign-up name field.");
    await page.getByRole("button", { name: "Show password" }).click();
    if (await password.getAttribute("type") !== "text") throw new Error("Password visibility toggle did not reveal the password.");
    await page.getByRole("button", { name: "Hide password" }).click();
    if (await password.getAttribute("type") !== "password") throw new Error("Password visibility toggle did not conceal the password.");
    if (mode === "signup") { await mkdir(outputDir, { recursive: true }); await page.screenshot({ path: `${outputDir}/native-signup.png`, fullPage: true }); }
  } finally {
    await browser.close();
  }
}

await verify("signup", "Sign up", "Create your account.");
await verify("login", "Log in", "Welcome back.");
console.log("Native account UI verification passed: sign-up and login stay inside the app and expose the correct forms.");
