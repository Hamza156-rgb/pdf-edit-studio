import { describe, expect, it } from "vitest";
import { addHistorySnapshot, redoHistory, undoHistory } from "./editorHistory";

type Snapshot = { pages: string[]; annotations: string[] };
const original: Snapshot = { pages: ["page-a", "page-b"], annotations: [] };
const drawn: Snapshot = { pages: ["page-a", "page-b"], annotations: ["draw-1"] };
const moved: Snapshot = { pages: ["page-a", "page-b"], annotations: ["draw-1-moved"] };
const resized: Snapshot = { pages: ["page-a", "page-b"], annotations: ["draw-1-resized"] };
const reordered: Snapshot = { pages: ["page-b", "page-a"], annotations: ["draw-1-resized"] };

describe("editor history", () => {
  it("restores the prior state for draw, move, resize, and page actions", () => {
    let history: Snapshot[] = [];
    history = addHistorySnapshot(history, original);
    history = addHistorySnapshot(history, drawn);
    history = addHistorySnapshot(history, moved);
    history = addHistorySnapshot(history, resized);

    const undoPageAction = undoHistory(history, reordered, []);
    expect(undoPageAction?.current).toEqual(resized);
    const undoResize = undoHistory(undoPageAction!.history, undoPageAction!.current, undoPageAction!.future);
    expect(undoResize?.current).toEqual(moved);
    const undoMove = undoHistory(undoResize!.history, undoResize!.current, undoResize!.future);
    expect(undoMove?.current).toEqual(drawn);
    const undoDraw = undoHistory(undoMove!.history, undoMove!.current, undoMove!.future);
    expect(undoDraw?.current).toEqual(original);
  });

  it("reapplies an undone page snapshot without losing the redo chain", () => {
    const undone = undoHistory([original, drawn, moved, resized], reordered, []);
    const redone = redoHistory(undone!.history, undone!.current, undone!.future);
    expect(redone?.current).toEqual(reordered);
    expect(redone?.history.at(-1)).toEqual(resized);
  });
});
