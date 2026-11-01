import { chromium } from "playwright";
import fs from "node:fs";
const files = ["brand/inklyne-icon.svg", "brand/inklyne-icon-v2.svg"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1180, height: 900 } });
const img = (f, s) => `<img src="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(f, "utf8")).toString("base64")}" width="${s}" height="${s}"/>`;
await p.setContent(`<body style="margin:0;background:#f2f4f8;font-family:sans-serif;padding:24px">${files.map((f, i) => `<div style="display:flex;gap:24px;align-items:flex-end;margin-bottom:28px"><b style="width:30px">v${i + 1}</b>${[340, 120, 64, 40, 29].map(s => img(f, s)).join("")}<div style="background:#111;padding:16px;border-radius:18px;display:flex;gap:16px;align-items:flex-end">${[96, 48].map(s => img(f, s)).join("")}</div></div>`).join("")}</body>`);
await p.screenshot({ path: process.argv[2], fullPage: true });
await b.close();
