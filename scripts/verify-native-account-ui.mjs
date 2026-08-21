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
    await page.getByLabel("Password").waitFor();
    if (mode === "signup") await page.getByLabel("Name").waitFor();
    else if (await page.getByLabel("Name").count()) throw new Error("The login view unexpectedly includes a sign-up name field.");
    if (mode === "signup") { await mkdir(outputDir, { recursive: true }); await page.screenshot({ path: `${outputDir}/native-signup.png`, fullPage: true }); }
  } finally {
    await browser.close();
  }
}

await verify("signup", "Sign up", "Create your account.");
await verify("login", "Log in", "Welcome back.");
console.log("Native account UI verification passed: sign-up and login stay inside the app and expose the correct forms.");
