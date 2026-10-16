import { describe, expect, it } from "vitest";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";
import { findWatermarkRanges, removeWatermarks } from "./watermark";

const body = "BT /F1 12 Tf 72 700 Td (Keep me EMC) Tj ET";
const watermark = "/Artifact <</Subtype /Watermark /Type /Pagination>> BDC q 0.5 g BT /F1 48 Tf 100 400 Td (DRAFT) Tj ET Q EMC";

describe("findWatermarkRanges", () => {
  it("finds artifact watermark blocks and ignores operator names inside strings", () => {
    const content = `${body}\n${watermark}\n/Span <</ActualText (x)>> BDC (EMC) Tj EMC`;
    const ranges = findWatermarkRanges(content);
    expect(ranges).toHaveLength(1);
    const [start, end] = ranges[0]!;
    expect(content.slice(start, end)).toBe(watermark);
  });

  it("removes optional-content layers that are named as watermarks", () => {
    const content = `/OC /MC0 BDC (Confidential) Tj EMC ${body}`;
    expect(findWatermarkRanges(content, name => name === "MC0")).toEqual([[0, content.indexOf(" BT")]]);
    expect(findWatermarkRanges(content, () => false)).toEqual([]);
  });

  it("keeps nested blocks balanced", () => {
    const content = `/Artifact <</Subtype /Watermark>> BDC /Span BMC (a) Tj EMC EMC ${body}`;
    expect(findWatermarkRanges(content)).toEqual([[0, content.indexOf(" BT")]]);
  });
});

describe("removeWatermarks", () => {
  it("strips marked watermarks and watermark annotations while keeping page content", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    page.node.set(PDFName.of("Contents"), pdf.context.register(pdf.context.flateStream(`${body}\n${watermark}`)));
    const annotation = pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Watermark", Rect: [0, 0, 10, 10] }));
    page.node.set(PDFName.of("Annots"), pdf.context.obj([annotation]));
    const bytes = await pdf.save();

    const result = await removeWatermarks(bytes.slice().buffer);
    expect(result.removed).toBe(2);

    const cleaned = await PDFDocument.load(result.bytes);
    const cleanedPage = cleaned.getPage(0);
    const ref = cleanedPage.node.get(PDFName.of("Contents")) as PDFRef;
    const text = new TextDecoder("latin1").decode(decodePDFRawStream(cleaned.context.lookup(ref) as PDFRawStream).decode());
    expect(text).toContain("Keep me");
    expect(text).not.toContain("DRAFT");
    expect(cleanedPage.node.lookup(PDFName.of("Annots"), PDFArray).size()).toBe(0);
  });

  it("reports nothing when the PDF has no marked watermark", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    const result = await removeWatermarks(bytes.slice().buffer);
    expect(result.removed).toBe(0);
  });
});
