import { describe, expect, it } from "vitest";
import { groupTextLines, guessFont } from "./pdfText";

// A US Letter page at scale 1: PDF y-up is flipped to viewport y-down.
const viewport = [1, 0, 0, -1, 0, 792];
const item = (str: string, x: number, y: number, width: number, size = 12, fontName = "f1") => ({ str, transform: [size, 0, 0, size, x, y], width, fontName });

describe("groupTextLines", () => {
  it("merges fragments on one baseline into a single line with spacing", () => {
    const lines = groupTextLines([item("Hello", 72, 700, 30), item("world", 106, 700, 32), item("Next line", 72, 680, 50)], { f1: { fontFamily: "sans-serif", ascent: .8, descent: -.2 } }, viewport, 612, 792);
    expect(lines.map(line => line.text)).toEqual(["Hello world", "Next line"]);
    const first = lines[0]!;
    expect(first.fontSize).toBe(12);
    expect(first.baseline * 792).toBeCloseTo(92);
    expect(first.x * 612).toBeLessThan(72);
    expect((first.x + first.width) * 612).toBeGreaterThan(138);
  });

  it("skips whitespace and rotated text", () => {
    const rotated = { str: "Sideways", transform: [0, 12, -12, 0, 300, 300], width: 40, fontName: "f1" };
    expect(groupTextLines([item("   ", 72, 700, 10), rotated], {}, viewport, 612, 792)).toEqual([]);
  });
});

describe("guessFont", () => {
  it("maps embedded font names to the closest standard font", () => {
    expect(guessFont(undefined, { name: "ABCDEF+TimesNewRomanPS-BoldMT" })).toEqual({ fontFamily: "TimesRoman", bold: true, italic: false });
    expect(guessFont({ fontFamily: "sans-serif" }, { name: "Arial-ItalicMT" })).toEqual({ fontFamily: "Helvetica", bold: false, italic: true });
    expect(guessFont({ fontFamily: "monospace" }, undefined).fontFamily).toBe("Courier");
    expect(guessFont(undefined, { name: "OpenSans-Regular" }).fontFamily).toBe("Helvetica");
  });
});
