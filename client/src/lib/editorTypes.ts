export type ToolName = "select" | "text" | "pen" | "highlight" | "eraser" | "whiteout" | "redact" | "rectangle" | "circle" | "line" | "arrow" | "image" | "signature";

export type SourceDocument = { id: string; name: string; bytes: ArrayBuffer };

export type EditorPage = {
  id: string;
  sourceId?: string;
  sourceIndex?: number;
  rotation: number;
  width: number;
  height: number;
  label: string;
  blank?: boolean;
};

export type Point = { x: number; y: number };

export type Annotation = {
  id: string;
  pageId: string;
  type: "text" | "path" | "highlight" | "whiteout" | "redact" | "shape" | "image" | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
  fill?: string;
  opacity?: number;
  strokeWidth?: number;
  text?: string;
  fontFamily?: "Helvetica" | "TimesRoman" | "Courier";
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  shape?: "rectangle" | "circle" | "line" | "arrow";
  points?: Point[];
  dataUrl?: string;
  status?: "pending" | "applied";
};

export type EditorSnapshot = { pages: EditorPage[]; annotations: Annotation[] };
