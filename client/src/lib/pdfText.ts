// Detects editable text lines on a PDF page so existing text can be replaced in place.
// Kept free of a runtime pdfjs import so the grouping logic is unit-testable in Node.

export type FontFamily = "Helvetica" | "TimesRoman" | "Courier";

export type TextLine = {
  key: string;
  text: string;
  /** Box in normalized page coordinates (0..1, top-left origin). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Baseline in normalized coordinates, used to place replacement text exactly. */
  baseline: number;
  fontSize: number;
  fontFamily: FontFamily;
  bold: boolean;
  italic: boolean;
};

export type RawTextItem = { str: string; transform: number[]; width: number; fontName: string };
export type FontStyle = { fontFamily?: string; ascent?: number; descent?: number };
export type FontInfo = { name?: string; bold?: boolean; black?: boolean; italic?: boolean };

type Positioned = { str: string; left: number; right: number; baseline: number; size: number; fontName: string };

function multiply(m1: number[], m2: number[]) {
  return [
    m1[0]! * m2[0]! + m1[2]! * m2[1]!,
    m1[1]! * m2[0]! + m1[3]! * m2[1]!,
    m1[0]! * m2[2]! + m1[2]! * m2[3]!,
    m1[1]! * m2[2]! + m1[3]! * m2[3]!,
    m1[0]! * m2[4]! + m1[2]! * m2[5]! + m1[4]!,
    m1[1]! * m2[4]! + m1[3]! * m2[5]! + m1[5]!,
  ];
}

export function guessFont(style: FontStyle | undefined, font: FontInfo | undefined): { fontFamily: FontFamily; bold: boolean; italic: boolean } {
  const name = (font?.name ?? "").toLowerCase();
  const generic = (style?.fontFamily ?? "").toLowerCase();
  const fontFamily: FontFamily = /courier|mono|consol|menlo/.test(name) || generic === "monospace" ? "Courier"
    : /times|serif|garamond|georgia|cambria|minion|palatino|book/.test(name.replace("sans", "")) || generic === "serif" ? "TimesRoman"
      : "Helvetica";
  const bold = Boolean(font?.bold || font?.black) || /bold|black|heavy|semibold|demi/.test(name);
  const italic = Boolean(font?.italic) || /italic|oblique/.test(name);
  return { fontFamily, bold, italic };
}

/**
 * Groups PDF.js text items into visual lines.
 * `viewportTransform` maps PDF space to viewport space (y down) at scale 1.
 */
export function groupTextLines(
  items: RawTextItem[],
  styles: Record<string, FontStyle>,
  viewportTransform: number[],
  viewportWidth: number,
  viewportHeight: number,
  fontLookup: (fontName: string) => FontInfo | undefined = () => undefined,
): TextLine[] {
  const positioned: Positioned[] = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const tx = multiply(viewportTransform, item.transform);
    // Only horizontal text (relative to the displayed page) can be replaced cleanly.
    if (Math.abs(tx[1]!) > Math.abs(tx[0]!) * 0.05 + 1e-6) continue;
    const size = Math.hypot(tx[2]!, tx[3]!);
    if (size < 2) continue;
    const scaleX = Math.hypot(viewportTransform[0]!, viewportTransform[1]!);
    positioned.push({ str: item.str, left: tx[4]!, right: tx[4]! + item.width * scaleX, baseline: tx[5]!, size, fontName: item.fontName });
  }
  positioned.sort((a, b) => Math.abs(a.baseline - b.baseline) < Math.min(a.size, b.size) * 0.3 ? a.left - b.left : a.baseline - b.baseline);

  const lines: Positioned[][] = [];
  for (const item of positioned) {
    const line = lines[lines.length - 1];
    const last = line?.[line.length - 1];
    if (last && Math.abs(last.baseline - item.baseline) < Math.min(last.size, item.size) * 0.3 && item.left - last.right < Math.max(last.size, item.size) * 1.2 && item.left - last.right > -last.size) line!.push(item);
    else lines.push([item]);
  }

  return lines.map((line, index) => {
    const first = line[0]!;
    let text = "";
    line.forEach((item, itemIndex) => {
      const previous = line[itemIndex - 1];
      if (previous && item.left - previous.right > first.size * 0.15 && !text.endsWith(" ") && !item.str.startsWith(" ")) text += " ";
      text += item.str;
    });
    const size = Math.max(...line.map(item => item.size));
    const style = styles[first.fontName];
    const ascent = style?.ascent && style.ascent > 0.5 && style.ascent < 1.2 ? style.ascent : 0.8;
    const descent = style?.descent && style.descent < 0 && style.descent > -0.5 ? style.descent : -0.2;
    const left = Math.min(...line.map(item => item.left));
    const right = Math.max(...line.map(item => item.right));
    const baseline = first.baseline;
    const top = baseline - size * ascent;
    const bottom = baseline - size * descent;
    // Pad slightly so the cover fully hides anti-aliased glyph edges.
    const pad = size * 0.08;
    return {
      key: `line-${index}-${Math.round(left)}-${Math.round(baseline)}`,
      text: text.trim(),
      x: Math.max(0, (left - pad) / viewportWidth),
      y: Math.max(0, (top - pad) / viewportHeight),
      width: Math.min(1, (right - left + pad * 2) / viewportWidth),
      height: Math.min(1, (bottom - top + pad * 2) / viewportHeight),
      baseline: baseline / viewportHeight,
      fontSize: Math.round(size * 10) / 10,
      ...guessFont(style, fontLookup(first.fontName)),
    };
  }).filter(line => line.text.length > 0);
}

type PdfJsPage = {
  getViewport: (options: { scale: number; rotation: number }) => { transform: number[]; width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[]; styles: Record<string, FontStyle> }>;
  commonObjs: { has: (id: string) => boolean; get: (id: string) => unknown };
};

export async function extractTextLines(page: PdfJsPage, rotation: number): Promise<TextLine[]> {
  const viewport = page.getViewport({ scale: 1, rotation });
  const content = await page.getTextContent();
  const items = content.items.filter((item): item is RawTextItem => typeof (item as RawTextItem).str === "string");
  const lookup = (fontName: string) => {
    try { return page.commonObjs.has(fontName) ? page.commonObjs.get(fontName) as FontInfo : undefined; } catch { return undefined; }
  };
  return groupTextLines(items, content.styles, viewport.transform, viewport.width, viewport.height, lookup);
}

/** Samples the rendered canvas to find the text ink color and the background behind it. */
export function sampleColors(canvas: HTMLCanvasElement, box: { x: number; y: number; width: number; height: number }) {
  const fallback = { ink: "#111111", paper: "#ffffff" };
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !canvas.width || !canvas.height) return fallback;
  const sx = Math.max(0, Math.floor(box.x * canvas.width));
  const sy = Math.max(0, Math.floor(box.y * canvas.height));
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(box.width * canvas.width)));
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(box.height * canvas.height)));
  let data: Uint8ClampedArray;
  try { data = context.getImageData(sx, sy, sw, sh).data; } catch { return fallback; }
  const buckets = new Map<string, { count: number; r: number; g: number; b: number; lum: number }>();
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index]!, g = data[index + 1]!, b = data[index + 2]!;
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
    bucket.count += 1; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
  }
  const ranked = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const paper = ranked[0];
  if (!paper) return fallback;
  // Ink is the most common color that contrasts clearly with the paper.
  const ink = ranked.find(bucket => Math.abs(bucket.lum - paper.lum) > 90) ?? ranked.reduce((darkest, bucket) => Math.abs(bucket.lum - paper.lum) > Math.abs(darkest.lum - paper.lum) ? bucket : darkest, paper);
  const hex = (bucket: typeof paper) => "#" + [bucket.r, bucket.g, bucket.b].map(total => Math.round(total / bucket.count).toString(16).padStart(2, "0")).join("");
  return { ink: hex(ink), paper: hex(paper) };
}
