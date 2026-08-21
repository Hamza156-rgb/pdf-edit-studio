import { describe, expect, it } from "vitest";
import { consumeStagedPdfFile, stagePdfFile } from "./stagedFile";

describe("staged PDF import", () => {
  it("consumes a staged file exactly once, preventing state updates from re-importing it", () => {
    const source = { name: "uploaded.pdf", size: 2048, type: "application/pdf" } as File;
    stagePdfFile(source);

    expect(consumeStagedPdfFile()).toBe(source);
    expect(consumeStagedPdfFile()).toBeNull();
  });
});
