import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { EditorPage, SourceDocument } from "./editorTypes";

// PDF.js consults this browser class while the shared browser PDF module loads. The export branch tested below does not render pages.
(globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = class {};

describe("exportEditedPdf", () => {
  it("creates a loadable PDF that includes page content and user annotations", async () => {
    const original = await PDFDocument.create();
    const basePage = original.addPage([595, 842]);
    const baseFont = await original.embedFont(StandardFonts.Helvetica);
    basePage.drawText("Original document", { x: 72, y: 760, size: 18, font: baseFont });
    const originalBytes = await original.save();
    const copiedBytes = new Uint8Array(originalBytes.byteLength);
    copiedBytes.set(originalBytes);
    const source: SourceDocument = { id: "source-1", name: "source.pdf", bytes: copiedBytes.buffer };
    const page: EditorPage = { id: "page-1", sourceId: source.id, sourceIndex: 0, rotation: 0, width: 595, height: 842, label: "Page 1" };

    const { exportEditedPdf } = await import("./pdf");
    const result = await exportEditedPdf({
      sources: [source],
      pages: [page],
      annotations: [
        { id: "text-1", pageId: page.id, type: "text", x: .12, y: .12, width: .3, height: .08, text: "Added in Editly", color: "#326ad8", opacity: 1, fontSize: 16, fontFamily: "Helvetica" },
        { id: "shape-1", pageId: page.id, type: "shape", x: .1, y: .25, width: .22, height: .08, color: "#172033", fill: "#eaf2ff", opacity: 1, strokeWidth: 2, shape: "rectangle" },
        { id: "path-1", pageId: page.id, type: "path", x: 0, y: 0, width: 1, height: 1, color: "#326ad8", opacity: 1, strokeWidth: 3, points: [{ x: .2, y: .4 }, { x: .35, y: .45 }, { x: .5, y: .42 }] },
      ],
    });

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
    expect(result.byteLength).toBeGreaterThan(originalBytes.byteLength);
  });
});
