import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, validatePdfFile } from "./pdfValidation";

const file = (name: string, type: string, size: number) => ({ name, type, size }) as File;

describe("validatePdfFile", () => {
  it("accepts a reasonably sized PDF", () => {
    expect(validatePdfFile(file("contract.pdf", "application/pdf", 1024))).toBeNull();
  });

  it("rejects non-PDF and oversized uploads before attempting browser parsing", () => {
    expect(validatePdfFile(file("notes.txt", "text/plain", 100))).toMatch(/Only PDF/);
    expect(validatePdfFile(file("large.pdf", "application/pdf", MAX_PDF_BYTES + 1))).toMatch(/50 MB/);
  });
});
