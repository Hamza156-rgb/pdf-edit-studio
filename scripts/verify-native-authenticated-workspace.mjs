import { chromium } from "playwright";

const baseUrl = process.env.PDF_EDITOR_URL || "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const user = { id: 501, openId: "native_regression", name: "Workspace Test", email: "workspace@example.com", loginMethod: "native", passwordHash: null, role: "user", accountStatus: "active", createdAt: "2026-08-21T00:00:00.000Z", updatedAt: "2026-08-21T00:00:00.000Z", lastSignedIn: "2026-08-21T00:00:00.000Z" };

function trpcResult(json) { return JSON.stringify([{ result: { data: { json } } }]); }

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
try {
  await page.route("**/api/trpc/auth.me**", route => route.fulfill({ contentType: "application/json", body: trpcResult(user) }));
  await page.route("**/api/trpc/documents.list**", route => route.fulfill({ contentType: "application/json", body: trpcResult([]) }));
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Good to see you, Workspace." }).waitFor();
  await page.getByText("Your account activity", { exact: true }).waitFor();
  await page.goto(`${baseUrl}/profile`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Your profile" }).waitFor();
  await page.getByText("workspace@example.com", { exact: true }).waitFor();
} finally {
  await browser.close();
}
console.log("Native authenticated workspace verification passed: a valid account session reaches dashboard and profile.");
