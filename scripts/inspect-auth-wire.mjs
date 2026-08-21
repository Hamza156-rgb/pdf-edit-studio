import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
const page = await browser.newPage();
page.on("response", async response => {
  if (!response.url().includes("/api/trpc/auth.me")) return;
  console.log(await response.text());
});
await page.goto(`${process.env.PDF_EDITOR_URL || "http://127.0.0.1:3000"}/account?mode=login`, { waitUntil: "networkidle" });
await browser.close();
