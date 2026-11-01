// Renders every Inklyne brand asset from brand/inklyne-icon.svg.
// Usage (from the repo root): node brand/render-assets.mjs
// Then regenerate native icons/splash: cd mobile && pnpm assets
import { chromium } from "playwright";
import fs from "node:fs";

const svg = fs.readFileSync("brand/inklyne-icon.svg", "utf8");
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const defs = inner.match(/<defs>[\s\S]*<\/defs>/)[0];
const art = inner.replace(/<defs>[\s\S]*<\/defs>/, "").replace(/<rect width="1024" height="1024"[^>]*\/>/g, "");
const bgRects = (rx) => `<rect width="1024" height="1024" rx="${rx}" fill="url(#bg)"/><rect width="1024" height="1024" rx="${rx}" fill="url(#glow)"/>`;
const svgDoc = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">${defs}${body}</svg>`;

const icon = { rounded: svgDoc(bgRects(230) + art), fullBleed: svgDoc(bgRects(0) + art), background: svgDoc(bgRects(0)),
  // Android adaptive foreground: artwork only, scaled into the 66% safe circle.
  foreground: svgDoc(`<g transform="translate(512 512) scale(.74) translate(-560 -500)">${art}</g>`) };
const font = `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,700&display=swap" rel="stylesheet">`;
const page = (w, h, body, transparent = false) => `<html><head>${font}<style>*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;${transparent ? "background:transparent" : ""};font-family:'DM Sans',sans-serif}</style></head><body>${body}</body></html>`;
const navy = "background:radial-gradient(circle at 30% 18%,#2a4597 0%,#15214f 42%,#0a1129 100%)";
const wordmark = (size, color) => `<span style="font-weight:700;font-size:${size}px;letter-spacing:-.045em;color:${color};line-height:1">Inklyne</span>`;

const jobs = [
  ["mobile/assets/icon-only.png", 1024, 1024, page(1024, 1024, icon.fullBleed)],
  ["mobile/assets/icon-background.png", 1024, 1024, page(1024, 1024, icon.background)],
  ["mobile/assets/icon-foreground.png", 1024, 1024, page(1024, 1024, icon.foreground, true), true],
  ...["splash.png", "splash-dark.png"].map(name => [`mobile/assets/${name}`, 2732, 2732, page(2732, 2732, `<div style="width:100%;height:100%;${navy};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:90px"><div style="width:560px;height:560px;filter:drop-shadow(0 60px 80px rgba(2,4,13,.6))">${icon.rounded}</div>${wordmark(230, "#fff")}<span style="font-size:72px;font-weight:500;color:#9fb3e6;letter-spacing:.01em;margin-top:-40px">Edit · Sign · Annotate PDFs</span></div>`)]),
  ["brand/export/inklyne-icon-1024.png", 1024, 1024, page(1024, 1024, icon.rounded, true), true],
  ["brand/export/app-store-icon-1024.png", 1024, 1024, page(1024, 1024, icon.fullBleed)],
  ["brand/export/play-store-icon-512.png", 512, 512, page(512, 512, icon.fullBleed)],
  ["brand/export/inklyne-logo-light.png", 1400, 360, page(1400, 360, `<div style="height:100%;display:flex;align-items:center;gap:56px;padding:0 60px"><div style="width:240px;height:240px">${icon.rounded}</div>${wordmark(170, "#121d47")}</div>`, true), true],
  ["brand/export/inklyne-logo-dark.png", 1400, 360, page(1400, 360, `<div style="height:100%;display:flex;align-items:center;gap:56px;padding:0 60px"><div style="width:240px;height:240px">${icon.rounded}</div>${wordmark(170, "#ffffff")}</div>`, true), true],
];

const browser = await chromium.launch();
for (const [out, w, h, html, transparent] of jobs) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, omitBackground: Boolean(transparent) });
  await p.close();
  console.log("✓", out);
}
await browser.close();
