import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { mkdir, readFile } from "node:fs/promises";

const baseUrl = process.env.PDF_EDITOR_URL || "http://127.0.0.1:3000";
const outputDir = "/tmp/pdf-edit-studio-workflow";

const source = await PDFDocument.create();
const font = await source.embedFont(StandardFonts.Helvetica);
for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
  const page = source.addPage([595, 842]);
  page.drawText(`PDF Edit Studio workflow test · page ${pageNumber}`, { x: 64, y: 760, size: 20, font });
}
const sourceBytes = await source.save();

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const browserPage = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const browserMessages = [];
browserPage.on("console", message => {
  if (message.type() === "error") browserMessages.push(`console: ${message.text()}`);
});
browserPage.on("pageerror", error => browserMessages.push(`page: ${error.message}`));

try {
  await browserPage.goto(baseUrl, { waitUntil: "networkidle" });
  await browserPage.locator('input[type="file"]').first().setInputFiles({
    name: "workflow.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(sourceBytes),
  });
  await browserPage.waitForURL(/\/editor$/, { timeout: 10_000 });
  await browserPage.waitForSelector("[data-page-canvas]", { timeout: 20_000 });
  await browserPage.getByLabel("Open page 4").scrollIntoViewIfNeeded();
  if (await browserPage.getByLabel("Open page 4").count() !== 1) throw new Error("The fourth page is not available in the thumbnail rail.");
  const railMetrics = await browserPage.locator(".editor-page-scroll").evaluate(element => ({ overflowY: getComputedStyle(element).overflowY, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  if (railMetrics.overflowY !== "scroll" || railMetrics.scrollHeight <= railMetrics.clientHeight) throw new Error("The page thumbnail rail does not provide usable scrolling for additional pages.");
  await browserPage.getByTitle("Draw").scrollIntoViewIfNeeded();
  await browserPage.screenshot({ path: `${outputDir}/four-page-editor.png`, fullPage: true });
  const canvas = await browserPage.locator("[data-page-canvas]").boundingBox();
  if (!canvas) throw new Error("Rendered page canvas was not measurable.");
  await browserPage.getByRole("button", { name: "Rotate page" }).click();
  await browserPage.getByRole("button", { name: "Rotate page" }).click();
  await browserPage.getByRole("button", { name: "Rotate page" }).click();
  await browserPage.waitForTimeout(750);
  if (browserMessages.some(message => /same canvas|PDF render/i.test(message))) {
    throw new Error(`Concurrent PDF canvas render error detected: ${browserMessages.join(" | ")}`);
  }

  await browserPage.locator('button[title="Text"]').click();
  await browserPage.mouse.click(canvas.x + canvas.width * .18, canvas.y + canvas.height * .16);
  await browserPage.locator('button[title="Draw"]').click();
  await browserPage.mouse.move(canvas.x + canvas.width * .2, canvas.y + canvas.height * .34);
  await browserPage.mouse.down();
  await browserPage.mouse.move(canvas.x + canvas.width * .5, canvas.y + canvas.height * .4, { steps: 8 });
  await browserPage.mouse.up();
  await browserPage.locator('button[title="Rectangle"]').click();
  await browserPage.mouse.move(canvas.x + canvas.width * .35, canvas.y + canvas.height * .48);
  await browserPage.mouse.down();
  await browserPage.mouse.move(canvas.x + canvas.width * .58, canvas.y + canvas.height * .58, { steps: 4 });
  await browserPage.mouse.up();
  await browserPage.locator('button[title="Eraser"]').click();
  await browserPage.mouse.move(canvas.x + canvas.width * .095, canvas.y + canvas.height * .26);
  await browserPage.mouse.down();
  await browserPage.mouse.move(canvas.x + canvas.width * .095, canvas.y + canvas.height * .9, { steps: 12 });
  await browserPage.mouse.up();
  await browserPage.screenshot({ path: `${outputDir}/eraser-preview.png`, fullPage: true });

  const downloadPromise = browserPage.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
  await browserPage.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  if (!download) {
    const notices = await browserPage.locator("[data-sonner-toast]").allTextContents();
    const pageText = await browserPage.locator("body").innerText();
    await browserPage.screenshot({ path: `${outputDir}/export-failure.png`, fullPage: true });
    throw new Error(`Export did not start. Notices: ${notices.join(" | ") || "none"}. Page text: ${pageText.slice(-1200)}. Browser messages: ${browserMessages.join(" | ") || "none"}.`);
  }
  const downloadPath = `${outputDir}/workflow-edited.pdf`;
  await download.saveAs(downloadPath);
  const exported = await PDFDocument.load(await readFile(downloadPath));
  if (exported.getPageCount() !== 4) throw new Error("Exported PDF has an unexpected page count.");
  if ((await readFile(downloadPath)).byteLength <= sourceBytes.byteLength) throw new Error("Exported PDF was not materially modified.");
  console.log(`Workflow passed: exported ${download.suggestedFilename()} with ${exported.getPageCount()} page.`);
} finally {
  await browser.close();
}
