import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFRef, PDFStream, PDFString } from "pdf-lib";

/**
 * Removes watermarks that are *marked* as watermarks inside the PDF, which is the same
 * scope as Acrobat's "Remove watermark":
 *  - /Watermark annotations
 *  - marked-content blocks tagged `/Artifact <</Subtype /Watermark>>` (Acrobat, Word, most generators)
 *  - content and form XObjects bound to an optional-content layer named like "Watermark"
 * Watermarks drawn as ordinary page content carry no marker and cannot be told apart from the
 * document itself; those are reported as "not found" so the user can cover them manually.
 */

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITERS = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);

type Operand = { start: number; text: string };
type OpenBlock = { start: number; remove: boolean };

function isWhitespace(code: number) { return WHITESPACE.has(code); }

function skipLiteralString(s: string, i: number) {
  let depth = 0;
  for (; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "\\") { i += 1; continue; }
    if (ch === "(") depth += 1;
    else if (ch === ")") { depth -= 1; if (depth === 0) return i + 1; }
  }
  return s.length;
}

function skipBalanced(s: string, i: number, open: string, close: string) {
  let depth = 0;
  while (i < s.length) {
    if (s[i] === "(") { i = skipLiteralString(s, i); continue; }
    if (s.startsWith(open, i)) { depth += 1; i += open.length; continue; }
    if (s.startsWith(close, i)) { depth -= 1; i += close.length; if (depth === 0) return i; continue; }
    i += 1;
  }
  return s.length;
}

/** Returns [start, end) ranges of watermark marked-content blocks in a decoded content stream. */
export function findWatermarkRanges(s: string, isWatermarkLayer: (name: string) => boolean = () => false): [number, number][] {
  const ranges: [number, number][] = [];
  const stack: OpenBlock[] = [];
  let operands: Operand[] = [];
  let i = 0;
  while (i < s.length) {
    const code = s.charCodeAt(i);
    if (isWhitespace(code)) { i += 1; continue; }
    const ch = s[i]!;
    const start = i;
    if (ch === "%") { while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i += 1; continue; }
    if (ch === "(") { i = skipLiteralString(s, i); operands.push({ start, text: s.slice(start, i) }); continue; }
    if (s.startsWith("<<", i)) { i = skipBalanced(s, i, "<<", ">>"); operands.push({ start, text: s.slice(start, i) }); continue; }
    if (ch === "<") { const end = s.indexOf(">", i); i = end === -1 ? s.length : end + 1; operands.push({ start, text: s.slice(start, i) }); continue; }
    if (ch === "[") { i = skipBalanced(s, i, "[", "]"); operands.push({ start, text: s.slice(start, i) }); continue; }
    if (ch === "/") {
      i += 1;
      while (i < s.length && !isWhitespace(s.charCodeAt(i)) && !DELIMITERS.has(s[i]!)) i += 1;
      operands.push({ start, text: s.slice(start, i) });
      continue;
    }
    if (DELIMITERS.has(ch)) { i += 1; continue; }
    while (i < s.length && !isWhitespace(s.charCodeAt(i)) && !DELIMITERS.has(s[i]!)) i += 1;
    const token = s.slice(start, i);
    if (/^[+\-.\d]/.test(token)) { operands.push({ start, text: token }); continue; }

    if (token === "BI") {
      // Inline image: binary data runs from ID to EI and may contain anything.
      const id = s.indexOf("ID", i);
      const ei = id === -1 ? -1 : s.slice(id + 3).search(/[\s]EI(?=[\s]|$)/);
      i = ei === -1 ? s.length : id + 3 + ei + 3;
    } else if (token === "BDC" || token === "BMC") {
      const tag = operands[operands.length - (token === "BDC" ? 2 : 1)];
      const props = token === "BDC" ? operands[operands.length - 1] : undefined;
      const remove = token === "BDC" && Boolean(tag && props) && (
        (tag!.text === "/Artifact" && /\/Watermark\b/.test(props!.text))
        || (tag!.text === "/OC" && props!.text.startsWith("/") && isWatermarkLayer(props!.text.slice(1)))
      );
      stack.push({ start: tag?.start ?? start, remove });
    } else if (token === "EMC") {
      const block = stack.pop();
      if (block?.remove && !stack.some(open => open.remove)) ranges.push([block.start, i]);
    }
    operands = [];
  }
  return ranges;
}

function removeRanges(s: string, ranges: [number, number][]) {
  let result = "";
  let cursor = 0;
  for (const [start, end] of ranges) { result += s.slice(cursor, start); cursor = end; }
  return result + s.slice(cursor);
}

function latin1(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  return out;
}

function fromLatin1(s: string) {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) bytes[i] = s.charCodeAt(i) & 0xff;
  return bytes;
}

function decodeStream(stream: PDFStream) {
  if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
  return stream.getContents();
}

function layerName(dict: PDFDict | undefined) {
  const name = dict?.get(PDFName.of("Name"));
  return name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : "";
}

const looksLikeWatermark = (name: string) => /water\s*mark/i.test(name);

export async function removeWatermarks(bytes: ArrayBuffer): Promise<{ bytes: Uint8Array; removed: number }> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes.slice(0));
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message)) throw new Error("This PDF is password-protected, so its watermark cannot be changed.");
    throw new Error("This PDF could not be prepared for watermark removal.");
  }
  const context = pdf.context;
  let removed = 0;

  for (const page of pdf.getPages()) {
    const node = page.node;

    const annots = node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (annots) {
      for (let index = annots.size() - 1; index >= 0; index -= 1) {
        const annot = annots.lookupMaybe(index, PDFDict);
        if (annot?.get(PDFName.of("Subtype")) === PDFName.of("Watermark")) { annots.remove(index); removed += 1; }
      }
    }

    const resources = node.Resources();
    const properties = resources?.lookupMaybe(PDFName.of("Properties"), PDFDict);
    const isWatermarkLayer = (name: string) => looksLikeWatermark(layerName(properties?.lookupMaybe(PDFName.of(name), PDFDict)));

    const contents = node.get(PDFName.of("Contents"));
    const refs = contents instanceof PDFRef ? [contents] : contents instanceof PDFArray ? contents.asArray().filter((item): item is PDFRef => item instanceof PDFRef) : [];
    for (const ref of refs) {
      const stream = context.lookup(ref);
      if (!(stream instanceof PDFStream)) continue;
      let decoded: Uint8Array;
      try { decoded = decodeStream(stream); } catch { continue; }
      const text = latin1(decoded);
      const ranges = findWatermarkRanges(text, isWatermarkLayer);
      if (!ranges.length) continue;
      removed += ranges.length;
      context.assign(ref, context.flateStream(fromLatin1(removeRanges(text, ranges))));
    }

    // Form XObjects tied to a "Watermark" optional-content layer are emptied in place.
    const xobjects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    for (const [, value] of xobjects?.entries() ?? []) {
      if (!(value instanceof PDFRef)) continue;
      const xobject = context.lookup(value);
      if (!(xobject instanceof PDFStream)) continue;
      const oc = xobject.dict.lookupMaybe(PDFName.of("OC"), PDFDict);
      if (!oc || !looksLikeWatermark(layerName(oc))) continue;
      const bbox = xobject.dict.get(PDFName.of("BBox"));
      context.assign(value, context.flateStream(new Uint8Array(), { Type: "XObject", Subtype: "Form", ...(bbox ? { BBox: bbox } : { BBox: [0, 0, 0, 0] }) }));
      removed += 1;
    }
  }

  return { bytes: removed ? await pdf.save() : new Uint8Array(bytes), removed };
}
