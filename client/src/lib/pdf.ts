import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Annotation, EditorPage, SourceDocument } from "./editorTypes";
export { MAX_PDF_BYTES, validatePdfFile } from "./pdfValidation";
import { validatePdfFile } from "./pdfValidation";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const sourceDocumentCache = new Map<string, Promise<Awaited<ReturnType<typeof pdfjsLib.getDocument>>["promise"] extends Promise<infer T> ? T : never>>();

async function loadSourceDocument(source: SourceDocument) {
  let documentPromise = sourceDocumentCache.get(source.id);
  if (!documentPromise) {
    const parserBytes = source.bytes.slice(0);
    const task = pdfjsLib.getDocument({ data: new Uint8Array(parserBytes), disableAutoFetch: false, disableStream: false });
    documentPromise = task.promise;
    sourceDocumentCache.set(source.id, documentPromise);
  }
  return documentPromise;
}

export async function clearPdfDocumentCache() {
  const entries = Array.from(sourceDocumentCache.values());
  sourceDocumentCache.clear();
  await Promise.all(entries.map(async entry => {
    try { await (await entry).cleanup(); } catch { /* A failed parser does not need further cleanup. */ }
  }));
}

export async function inspectPdf(file: File) {
  const bytes = await file.arrayBuffer();
  try {
    const parserBytes = bytes.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(parserBytes) });
    const document = await loadingTask.promise;
    return { bytes, pageCount: document.numPages, document };
  } catch {
    throw new Error("This PDF could not be read. It may be corrupted, encrypted, or use unsupported features.");
  }
}

export async function getPdfPage(source: SourceDocument, index: number) {
  const document = await loadSourceDocument(source);
  return document.getPage(index + 1);
}

export async function renderPdfPage(page: Awaited<ReturnType<typeof getPdfPage>>, canvas: HTMLCanvasElement, rotation: number, preferredScale: number) {
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const maxCanvasDimension = 2300;
  const maxCanvasPixels = 5_000_000;
  const scaleByDimension = maxCanvasDimension / Math.max(baseViewport.width, baseViewport.height);
  const scaleByArea = Math.sqrt(maxCanvasPixels / (baseViewport.width * baseViewport.height));
  const safeScale = Math.max(.45, Math.min(preferredScale, scaleByDimension, scaleByArea));

  const attemptRender = async (scale: number) => {
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser could not create a PDF canvas.");
    await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
  };

  try {
    await attemptRender(safeScale);
  } catch (error) {
    if (safeScale <= .5) throw error;
    await attemptRender(Math.max(.45, safeScale * .55));
  }
}

export function toHexRgb(hex = "#172033") {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map(part => part + part).join("") : value.padEnd(6, "0");
  return rgb(parseInt(normalized.slice(0, 2), 16) / 255, parseInt(normalized.slice(2, 4), 16) / 255, parseInt(normalized.slice(4, 6), 16) / 255);
}

function textFont(annotation: Annotation) {
  if (annotation.fontFamily === "TimesRoman") return annotation.bold ? StandardFonts.TimesRomanBold : annotation.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
  if (annotation.fontFamily === "Courier") return annotation.bold ? StandardFonts.CourierBold : annotation.italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
  return annotation.bold ? StandardFonts.HelveticaBold : annotation.italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
}

function pathString(points: NonNullable<Annotation["points"]>, pageWidth: number, pageHeight: number) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x * pageWidth} ${(1 - point.y) * pageHeight}`).join(" ");
}

async function flattenPageWithRemovals(source: SourceDocument, pageIndex: number, rotation: number, removals: Annotation[]) {
  const page = await getPdfPage(source, pageIndex);
  const viewport = page.getViewport({ scale: 2, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this page for secure whiteout.");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  for (const annotation of removals) {
    context.save();
    context.globalAlpha = 1;
    context.fillStyle = annotation.type === "redact" && annotation.status === "applied" ? "#111827" : annotation.color || "#ffffff";
    context.strokeStyle = annotation.color || "#ffffff";
    if (annotation.points?.length) {
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = Math.max(3, (annotation.strokeWidth || 12) * 2);
      context.beginPath();
      annotation.points.forEach((point, index) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    } else {
      context.fillRect(annotation.x * canvas.width, annotation.y * canvas.height, annotation.width * canvas.width, annotation.height * canvas.height);
      if (annotation.type === "redact" && annotation.status === "applied") {
        context.fillStyle = "#f8fafc";
        context.font = `${Math.max(8, Math.min(13, annotation.height * canvas.height * 0.35))}px sans-serif`;
        context.textAlign = "center";
        context.fillText("REDACTED", (annotation.x + annotation.width / 2) * canvas.width, (annotation.y + annotation.height / 2) * canvas.height + 4);
      }
    }
    context.restore();
  }
  return { png: await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Unable to flatten page")), "image/png")), width: viewport.width / 2, height: viewport.height / 2 };
}

async function drawAnnotation(pdf: PDFDocument, page: ReturnType<PDFDocument["addPage"]>, annotation: Annotation) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const x = annotation.x * pageWidth;
  const y = pageHeight - (annotation.y + annotation.height) * pageHeight;
  const width = annotation.width * pageWidth;
  const height = annotation.height * pageHeight;
  const color = toHexRgb(annotation.color);
  const opacity = annotation.opacity ?? 1;

  if (annotation.type === "text" || annotation.type === "signature") {
    const font = await pdf.embedFont(annotation.type === "signature" ? StandardFonts.CourierOblique : textFont(annotation));
    const fontSize = annotation.fontSize ?? (annotation.type === "signature" ? 22 : 16);
    const lines = (annotation.text || "").split("\n");
    lines.forEach((line, index) => page.drawText(line, { x, y: y + height - fontSize * (index + 1), size: fontSize, font, color, opacity }));
    return;
  }

  if (annotation.type === "path" || annotation.type === "highlight") {
    if (!annotation.points?.length) return;
    page.drawSvgPath(pathString(annotation.points, pageWidth, pageHeight), {
      borderColor: color,
      borderWidth: annotation.strokeWidth ?? (annotation.type === "highlight" ? 16 : 2),
      borderOpacity: opacity,
    });
    return;
  }

  if (annotation.type === "shape") {
    const fill = annotation.fill && annotation.fill !== "transparent" ? toHexRgb(annotation.fill) : undefined;
    if (annotation.shape === "circle") page.drawEllipse({ x: x + width / 2, y: y + height / 2, xScale: Math.abs(width / 2), yScale: Math.abs(height / 2), borderColor: color, borderWidth: annotation.strokeWidth ?? 2, color: fill, opacity, borderOpacity: opacity });
    else if (annotation.shape === "line" || annotation.shape === "arrow") {
      const start = { x, y: pageHeight - annotation.y * pageHeight };
      const end = { x: x + width, y };
      page.drawLine({ start, end, color, thickness: annotation.strokeWidth ?? 2, opacity });
      if (annotation.shape === "arrow") {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const size = 12;
        page.drawLine({ start: end, end: { x: end.x - size * Math.cos(angle - Math.PI / 6), y: end.y - size * Math.sin(angle - Math.PI / 6) }, color, thickness: annotation.strokeWidth ?? 2, opacity });
        page.drawLine({ start: end, end: { x: end.x - size * Math.cos(angle + Math.PI / 6), y: end.y - size * Math.sin(angle + Math.PI / 6) }, color, thickness: annotation.strokeWidth ?? 2, opacity });
      }
    } else page.drawRectangle({ x, y, width, height, borderColor: color, borderWidth: annotation.strokeWidth ?? 2, color: fill, opacity, borderOpacity: opacity });
    return;
  }

  if (annotation.type === "image" && annotation.dataUrl) {
    const imageBytes = await fetch(annotation.dataUrl).then(response => response.arrayBuffer());
    const image = annotation.dataUrl.startsWith("data:image/png") ? await pdf.embedPng(imageBytes) : await pdf.embedJpg(imageBytes);
    page.drawImage(image, { x, y, width, height, opacity, rotate: degrees(annotation.rotation ?? 0) });
  }
}

export async function exportEditedPdf({ sources, pages, annotations, onlyPageId }: { sources: SourceDocument[]; pages: EditorPage[]; annotations: Annotation[]; onlyPageId?: string }) {
  const pdf = await PDFDocument.create();
  const sourceLookup = new Map(sources.map(source => [source.id, source]));
  const activePages = onlyPageId ? pages.filter(page => page.id === onlyPageId) : pages;
  for (const pageModel of activePages) {
    const pageAnnotations = annotations.filter(annotation => annotation.pageId === pageModel.id);
    const removals = pageAnnotations.filter(annotation => annotation.type === "whiteout" || (annotation.type === "redact" && annotation.status === "applied"));
    let page;
    if (pageModel.blank || !pageModel.sourceId || pageModel.sourceIndex === undefined) {
      page = pdf.addPage([pageModel.width, pageModel.height]);
    } else {
      const source = sourceLookup.get(pageModel.sourceId);
      if (!source) throw new Error("A source page is unavailable in this session.");
      if (removals.length) {
        const flattened = await flattenPageWithRemovals(source, pageModel.sourceIndex, pageModel.rotation, removals);
        page = pdf.addPage([flattened.width, flattened.height]);
        const flattenedImage = await pdf.embedPng(await flattened.png.arrayBuffer());
        page.drawImage(flattenedImage, { x: 0, y: 0, width: flattened.width, height: flattened.height });
      } else {
        const sourcePdf = await PDFDocument.load(source.bytes.slice(0));
        const [copied] = await pdf.copyPages(sourcePdf, [pageModel.sourceIndex]);
        page = pdf.addPage(copied);
        if (pageModel.rotation) page.setRotation(degrees(pageModel.rotation));
      }
    }
    for (const annotation of pageAnnotations.filter(annotation => annotation.type !== "whiteout" && annotation.type !== "redact")) await drawAnnotation(pdf, page, annotation);
  }
  return pdf.save();
}

export function triggerPdfDownload(bytes: Uint8Array, name: string) {
  const safeBytes = new Uint8Array(bytes.byteLength);
  safeBytes.set(bytes);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([safeBytes.buffer], { type: "application/pdf" }));
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
