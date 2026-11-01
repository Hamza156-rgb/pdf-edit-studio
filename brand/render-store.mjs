// Composes App Store / Google Play listing images from raw app captures (1290×2796 PNGs).
// Usage (from the repo root): node brand/render-store.mjs <folder-with-raw-captures>
import { chromium } from "playwright";
import fs from "node:fs";

const RAW = process.argv[2];
const icon = fs.readFileSync("brand/inklyne-icon.svg", "utf8");
const b64 = (file) => `data:image/png;base64,${fs.readFileSync(`${RAW}/${file}`).toString("base64")}`;
const slides = [
  ["03-home.png", "Edit any PDF,", "right on your phone"],
  ["04-edit-text.png", "Change the text", "in any PDF"],
  ["05-sign.png", "Sign documents", "in seconds"],
  ["06-tools.png", "Every tool you need,", "in one place"],
  ["07-library.png", "Your files stay", "on your device"],
];
const font = `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,700&display=swap" rel="stylesheet">`;
const bg = "radial-gradient(circle at 25% 12%,#2f4fa8 0%,#15214f 45%,#0a1129 100%)";

// Phone frame: bezel + status bar + the real screen.
const phone = (src, width) => {
  const height = width * 2796 / 1290, bar = width * 0.105, radius = width * 0.13, bezel = width * 0.028;
  return `<div style="width:${width + bezel * 2}px;padding:${bezel}px;border-radius:${radius + bezel}px;background:linear-gradient(145deg,#2b3550,#0b1022);box-shadow:0 ${width * .08}px ${width * .16}px rgba(2,4,13,.55),inset 0 1px 0 rgba(255,255,255,.18)">
    <div style="position:relative;width:${width}px;height:${height + bar}px;border-radius:${radius}px;overflow:hidden;background:#f5f7fb">
      <div style="height:${bar}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${width * .09}px;font-weight:700;font-size:${width * .045}px;color:#0f172a">
        <span>9:41</span><span style="position:absolute;left:50%;top:${bar * .2}px;transform:translateX(-50%);width:${width * .3}px;height:${bar * .62}px;border-radius:999px;background:#0b1022"></span><span style="letter-spacing:.1em">▮▮▮ ◔ ▭</span>
      </div>
      <img src="${src}" style="display:block;width:${width}px;height:${height}px">
    </div></div>`;
};
const screen = (w, h, [file, line1, line2], phoneWidth, headSize) => `<html><head>${font}<style>*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;background:${bg};font-family:'DM Sans',sans-serif;overflow:hidden;display:flex;flex-direction:column;align-items:center}</style></head><body>
  <div style="margin-top:${h * .055}px;display:flex;align-items:center;gap:${w * .018}px;opacity:.9"><div style="width:${w * .055}px;height:${w * .055}px">${icon}</div><span style="color:#cfe0ff;font-weight:700;font-size:${w * .03}px;letter-spacing:-.02em">Inklyne</span></div>
  <h1 style="margin-top:${h * .02}px;text-align:center;color:#fff;font-weight:700;font-size:${headSize}px;line-height:1.05;letter-spacing:-.045em">${line1}<br><span style="background:linear-gradient(90deg,#8eb0ff,#b79bff);-webkit-background-clip:text;color:transparent">${line2}</span></h1>
  <div style="margin-top:${h * .045}px">${phone(b64(file), phoneWidth)}</div>
</body></html>`;

const feature = `<html><head>${font}<style>*{margin:0;box-sizing:border-box}body{width:1024px;height:500px;background:${bg};font-family:'DM Sans',sans-serif;overflow:hidden;position:relative}</style></head><body>
  <div style="position:absolute;left:64px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:22px;width:470px">
    <div style="display:flex;align-items:center;gap:20px"><div style="width:96px;height:96px;filter:drop-shadow(0 14px 22px rgba(2,4,13,.55))">${icon}</div><span style="color:#fff;font-weight:700;font-size:64px;letter-spacing:-.05em">Inklyne</span></div>
    <p style="color:#fff;font-weight:700;font-size:34px;line-height:1.15;letter-spacing:-.03em">Edit, sign &amp; annotate<br><span style="background:linear-gradient(90deg,#8eb0ff,#b79bff);-webkit-background-clip:text;color:transparent">any PDF on your phone</span></p>
  </div>
  <div style="position:absolute;right:120px;top:52px;transform:rotate(8deg)">${phone(b64("04-edit-text.png"), 200)}</div>
  <div style="position:absolute;right:-6px;top:110px;transform:rotate(14deg);opacity:.95">${phone(b64("05-sign.png"), 170)}</div>
</body></html>`;

const browser = await chromium.launch();
const render = async (html, w, h, out) => {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, type: "jpeg", quality: 90 }); await p.close(); console.log("✓", out);
};
for (const [i, slide] of slides.entries()) {
  const n = String(i + 1).padStart(2, "0");
  await render(screen(1290, 2796, slide, 880, 112), 1290, 2796, `brand/store/ios-6.7/${n}.jpg`);
  await render(screen(1080, 1920, slide, 560, 84), 1080, 1920, `brand/store/android-phone/${n}.jpg`);
}
await render(feature, 1024, 500, "brand/store/play-feature-graphic.jpg");
await browser.close();
