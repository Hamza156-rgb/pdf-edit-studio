import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandMark, DocumentStack } from "@/components/Depth";
import { Annotation, EditorPage, EditorSnapshot, Point, SourceDocument, ToolName } from "@/lib/editorTypes";
import { addHistorySnapshot, redoHistory, undoHistory } from "@/lib/editorHistory";
import { clearPdfDocumentCache, exportEditedPdf, getPdfPage, inspectPdf, renderPdfPage, TEXT_LINE_HEIGHT, triggerPdfDownload, validatePdfFile } from "@/lib/pdf";
import { extractTextLines, sampleColors, TextLine } from "@/lib/pdfText";
import { removeWatermarks } from "@/lib/watermark";
import { DashboardDensity, loadDashboardDensity, saveDashboardDensity, toggleDashboardDensity } from "@/lib/dashboardDensity";
import { clearEditorSession, loadEditorSession, saveEditorSession, saveLibraryDocument } from "@/lib/session";
import { consumeStagedEditorSession, consumeStagedPdfFile } from "@/lib/stagedFile";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ChevronLeft, ChevronRight, Circle, Copy, Download, FileStack, FileText, Highlighter, ImagePlus, LayoutList, LayoutPanelLeft, Loader2, LockKeyhole, Maximize2, Minus, MousePointer2, MoveHorizontal, Paintbrush, Pencil, Plus, Redo2, RotateCcw, RotateCw, Rows3, Save, Scissors, ShieldAlert, Shrink, Signature, SlidersHorizontal, X, Square, Stamp, TextCursorInput, Trash2, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { ChangeEvent, CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const uid = () => crypto.randomUUID();
type ToolMeta = { tool: ToolName; label: string; title?: string; icon: typeof MousePointer2; hint: string };
const toolMeta: ToolMeta[] = [
  { tool: "select", label: "Select", icon: MousePointer2, hint: "Pick, move, and resize objects you added." },
  { tool: "edittext", label: "Edit text", icon: TextCursorInput, hint: "Click any line of existing text to rewrite it." },
  { tool: "text", label: "Add text", title: "Text", icon: FileText, hint: "Click anywhere on the page to add a text box." },
  { tool: "whiteout", label: "Whiteout", icon: Square, hint: "Drag to cover content with a white box." },
  { tool: "redact", label: "Redact", icon: ShieldAlert, hint: "Mark areas, then apply permanent redactions." },
  { tool: "pen", label: "Draw", icon: Pencil, hint: "Draw freehand on the page." },
  { tool: "highlight", label: "Highlight", icon: Highlighter, hint: "Drag across text to highlight it." },
  { tool: "eraser", label: "Eraser", icon: Paintbrush, hint: "Paint white over anything on the page." },
  { tool: "rectangle", label: "Rectangle", icon: Square, hint: "Drag to draw a rectangle." },
  { tool: "circle", label: "Circle", icon: Circle, hint: "Drag to draw an ellipse." },
  { tool: "line", label: "Line", icon: Minus, hint: "Drag to draw a straight line." },
  { tool: "arrow", label: "Arrow", icon: ArrowRight, hint: "Drag to draw an arrow." },
  { tool: "image", label: "Image", icon: ImagePlus, hint: "Choose an image, then click to place it." },
  { tool: "signature", label: "Sign", icon: Signature, hint: "Type, draw, or upload a signature." },
];
const toolGroups: { label: string; tools: ToolName[] }[] = [
  { label: "Edit", tools: ["select", "edittext", "text", "whiteout", "redact"] },
  { label: "Annotate", tools: ["pen", "highlight", "eraser", "rectangle", "circle", "line", "arrow"] },
  { label: "Insert", tools: ["image", "signature"] },
];
const metaFor = (tool: ToolName) => toolMeta.find(item => item.tool === tool)!;

const cssFont = (annotation: Annotation) => annotation.type === "signature" ? "'Instrument Serif', serif" : annotation.fontFamily === "Courier" ? "'Courier New', Courier, monospace" : annotation.fontFamily === "TimesRoman" ? "'Times New Roman', Times, serif" : "Helvetica, Arial, sans-serif";

type PointerDraft = { start: Point; annotationId?: string; mode: "draw" | "shape" | "move" | "resize"; selectedId?: string; before?: EditorSnapshot };

export default function PdfEditor() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const createAccountDocument = trpc.documents.create.useMutation();
  const pendingFile = useMemo(() => consumeStagedPdfFile(), []);
  const pendingSession = useMemo(() => consumeStagedEditorSession(), []);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [pages, setPages] = useState<EditorPage[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [fileName, setFileName] = useState("Untitled document");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [tool, setToolState] = useState<ToolName>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [color, setColor] = useState("#326ad8");
  const [fill, setFill] = useState("transparent");
  const [opacity, setOpacity] = useState(0.92);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState<"Helvetica" | "TimesRoman" | "Courier">("Helvetica");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [future, setFuture] = useState<EditorSnapshot[]>([]);
  const [exporting, setExporting] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(pendingFile));
  const [loadingText, setLoadingText] = useState("Preparing your PDF…");
  const [fileError, setFileError] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState(false);
  const [redactDialog, setRedactDialog] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<"type" | "draw" | "upload">("type");
  const [signatureText, setSignatureText] = useState("Signature");
  const [showPagesOnMobile, setShowPagesOnMobile] = useState(false);
  const [showToolSheet, setShowToolSheet] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<"width" | "page">("page");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [density, setDensity] = useState<DashboardDensity>(() => loadDashboardDensity(window.localStorage));
  const [libraryId, setLibraryId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const mergeRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);
  const pointerRef = useRef<PointerDraft | null>(null);
  const pendingEditRef = useRef<EditorSnapshot | null>(null);
  const initialImportHandledRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const setTool = (next: ToolName) => { setToolState(next); setEditingId(null); if (next !== "select") setSelectedId(null); };

  const commit = useCallback((nextPages: EditorPage[], nextAnnotations: Annotation[], label?: string) => {
    setHistory(current => addHistorySnapshot(current, { pages, annotations }));
    setFuture([]);
    setPages(nextPages);
    setAnnotations(nextAnnotations);
    if (label) toast.success(label);
  }, [pages, annotations]);

  const loadPdf = useCallback(async (file: File, mode: "replace" | "merge" = "replace") => {
    const validation = validatePdfFile(file);
    if (validation) { setFileError(validation); return; }
    setLoading(true); setLoadingText(mode === "merge" ? "Adding pages…" : "Reading your PDF…"); setFileError(null);
    try {
      const inspected = await inspectPdf(file);
      const source: SourceDocument = { id: uid(), name: file.name, bytes: inspected.bytes };
      const sourcePages: EditorPage[] = [];
      for (let index = 0; index < inspected.pageCount; index += 1) {
        const page = await inspected.document.getPage(index + 1);
        const viewport = page.getViewport({ scale: 1 });
        sourcePages.push({ id: uid(), sourceId: source.id, sourceIndex: index, rotation: 0, width: viewport.width, height: viewport.height, label: `Page ${index + 1}` });
      }
      if (mode === "replace") {
        await clearPdfDocumentCache();
        setSources([source]); setPages(sourcePages); setAnnotations([]); setHistory([]); setFuture([]); setFileName(file.name.replace(/\.pdf$/i, "")); setActivePageId(sourcePages[0]?.id ?? null);
      } else {
        commit([...pages, ...sourcePages], annotations, `${sourcePages.length} page${sourcePages.length === 1 ? "" : "s"} added`); setSources(current => [...current, source]);
      }
    } catch (error) { setFileError(error instanceof Error ? error.message : "We could not open this document."); }
    finally { setLoading(false); }
  }, [annotations, commit, pages]);

  useEffect(() => {
    if (initialImportHandledRef.current) return;
    if (pendingSession) {
      initialImportHandledRef.current = true;
      setSources(pendingSession.sources); setPages(pendingSession.pages); setAnnotations(pendingSession.annotations); setFileName(pendingSession.fileName); setActivePageId(pendingSession.pages[0]?.id ?? null); setLibraryId((pendingSession as typeof pendingSession & { id?: string }).id ?? null);
    } else if (pendingFile) {
      initialImportHandledRef.current = true;
      void loadPdf(pendingFile);
    }
  }, [loadPdf, pendingFile, pendingSession]);
  useEffect(() => { if (!pendingFile) void loadEditorSession().then(session => setRecoverable(Boolean(session))); }, [pendingFile]);
  useEffect(() => {
    if (!pages.length || !sources.length) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => void saveEditorSession({ sources, pages, annotations, fileName, savedAt: Date.now() }).then(() => setSaveStatus("saved")).catch(() => setSaveStatus("error")), 900);
    return () => window.clearTimeout(timer);
  }, [annotations, fileName, pages, sources]);

  const goToPage = (offset: number) => {
    const currentIndex = pages.findIndex(page => page.id === activePageId);
    const targetPage = pages[currentIndex + offset];
    if (!targetPage) return false;
    setActivePageId(targetPage.id); setSelectedId(null); setEditingId(null);
    return true;
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDensity(current => {
          const next = toggleDashboardDensity(current);
          saveDashboardDensity(window.localStorage, next);
          return next;
        });
        return;
      }
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void handleDownload(); }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) { event.preventDefault(); deleteSelected(); }
      if (event.key === "Enter" && target === document.body && selected && (selected.type === "text" || selected.type === "signature")) { event.preventDefault(); setEditingId(selected.id); }
      if (event.key === "Escape") { setSelectedId(null); setEditingId(null); setToolState("select"); }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && goToPage(event.key === "ArrowLeft" ? -1 : 1)) event.preventDefault();
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  });

  const restoreSession = async () => {
    const session = await loadEditorSession();
    if (!session) return setRecoverable(false);
    setSources(session.sources); setPages(session.pages); setAnnotations(session.annotations); setFileName(session.fileName); setActivePageId(session.pages[0]?.id ?? null); setRecoverable(false); toast.success("Your local editing session is back.");
  };
  const discardSession = async () => { await clearEditorSession(); setRecoverable(false); };
  const undo = () => { const result = undoHistory(history, { pages, annotations }, future); if (!result) return; setFuture(result.future); setPages(result.current.pages); setAnnotations(result.current.annotations); setHistory(result.history); setSelectedId(null); setEditingId(null); };
  const redo = () => { const result = redoHistory(history, { pages, annotations }, future); if (!result) return; setHistory(result.history); setPages(result.current.pages); setAnnotations(result.current.annotations); setFuture(result.future); setSelectedId(null); setEditingId(null); };
  const deleteSelected = () => { if (!selectedId) return; commit(pages, annotations.filter(annotation => annotation.id !== selectedId)); setSelectedId(null); setEditingId(null); };
  const selected = annotations.find(annotation => annotation.id === selectedId) ?? null;
  const activePage = pages.find(page => page.id === activePageId) ?? null;
  const activeIndex = pages.findIndex(page => page.id === activePageId);

  const getPoint = (event: ReactPointerEvent<HTMLDivElement>): Point => { const box = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) }; };
  const newShapeType = (candidate: ToolName): Annotation["shape"] => candidate === "circle" ? "circle" : candidate === "line" ? "line" : candidate === "arrow" ? "arrow" : "rectangle";
  const createAnnotation = (annotation: Annotation) => { commit(pages, [...annotations, annotation]); setSelectedId(annotation.id); };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePage) return;
    const point = getPoint(event);
    setEditingId(null);
    if (tool === "select" || tool === "edittext") { setSelectedId(null); return; }
    if (tool === "text") { const annotation: Annotation = { id: uid(), pageId: activePage.id, type: "text", x: point.x, y: point.y, width: .28, height: .065, text: "Type here", color, opacity, fontSize, fontFamily, bold, italic }; createAnnotation(annotation); setEditingId(annotation.id); return; }
    if (tool === "signature" && signatureMode === "type") { const annotation: Annotation = { id: uid(), pageId: activePage.id, type: "signature", x: point.x, y: point.y, width: .25, height: .08, text: signatureText || "Signature", color: "#172033", opacity: 1, fontSize: 22 }; createAnnotation(annotation); return; }
    if ((tool === "image" || (tool === "signature" && signatureMode === "upload")) && imageDataUrl) { const annotation: Annotation = { id: uid(), pageId: activePage.id, type: "image", x: point.x, y: point.y, width: .24, height: .18, dataUrl: imageDataUrl, opacity: 1 }; createAnnotation(annotation); return; }
    if (["pen", "highlight", "eraser"].includes(tool) || (tool === "signature" && signatureMode === "draw")) {
      const type: Annotation["type"] = tool === "highlight" ? "highlight" : tool === "eraser" ? "whiteout" : "path";
      const annotation: Annotation = { id: uid(), pageId: activePage.id, type, x: 0, y: 0, width: 1, height: 1, points: [point], color: tool === "highlight" ? "#f4c84a" : tool === "eraser" ? "#ffffff" : tool === "signature" ? "#172033" : color, opacity: tool === "highlight" ? .42 : tool === "eraser" ? 1 : opacity, strokeWidth: tool === "signature" ? 3 : strokeWidth };
      setAnnotations(current => [...current, annotation]); setSelectedId(annotation.id); pointerRef.current = { start: point, annotationId: annotation.id, mode: "draw", before: { pages, annotations } }; event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    if (["whiteout", "redact", "rectangle", "circle", "line", "arrow"].includes(tool)) { pointerRef.current = { start: point, mode: "shape" }; event.currentTarget.setPointerCapture(event.pointerId); }
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = pointerRef.current; if (!draft || !activePage) return; const point = getPoint(event);
    if (draft.mode === "draw" && draft.annotationId) setAnnotations(current => current.map(annotation => annotation.id === draft.annotationId ? { ...annotation, points: [...(annotation.points ?? []), point] } : annotation));
    if (draft.mode === "move" && draft.selectedId) { const dx = point.x - draft.start.x; const dy = point.y - draft.start.y; const initial = draft.before?.annotations.find(annotation => annotation.id === draft.selectedId); if (!initial) return; setAnnotations(current => current.map(annotation => annotation.id === draft.selectedId ? { ...annotation, x: Math.max(0, Math.min(1 - annotation.width, initial.x + dx)), y: Math.max(0, Math.min(1 - annotation.height, initial.y + dy)) } : annotation)); }
    if (draft.mode === "resize" && draft.selectedId) { const initial = draft.before?.annotations.find(annotation => annotation.id === draft.selectedId); if (!initial) return; setAnnotations(current => current.map(annotation => annotation.id === draft.selectedId ? { ...annotation, width: Math.max(.03, Math.min(1 - annotation.x, initial.width + point.x - draft.start.x)), height: Math.max(.02, Math.min(1 - annotation.y, initial.height + point.y - draft.start.y)) } : annotation)); }
  };

  const onCanvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = pointerRef.current; if (!draft || !activePage) return; const end = getPoint(event); pointerRef.current = null;
    if (draft.mode === "draw" || draft.mode === "move" || draft.mode === "resize") {
      const moved = draft.mode === "draw" || annotations.some(annotation => annotation.id === draft.selectedId && draft.before?.annotations.find(before => before.id === annotation.id) !== annotation);
      if (draft.before && moved) { setHistory(current => addHistorySnapshot(current, draft.before!)); setFuture([]); }
      return;
    }
    if (draft.mode === "shape") { const x = Math.min(draft.start.x, end.x); const y = Math.min(draft.start.y, end.y); const width = Math.max(.01, Math.abs(end.x - draft.start.x)); const height = Math.max(.01, Math.abs(end.y - draft.start.y)); const annotation: Annotation = tool === "whiteout" ? { id: uid(), pageId: activePage.id, type: "whiteout", x, y, width, height, color: "#ffffff" } : tool === "redact" ? { id: uid(), pageId: activePage.id, type: "redact", x, y, width, height, status: "pending" } : { id: uid(), pageId: activePage.id, type: "shape", x, y, width, height, color, fill, opacity, strokeWidth, shape: newShapeType(tool) };
      createAnnotation(annotation); }
  };

  const capturePage = (event: ReactPointerEvent<HTMLElement>) => { const surface = event.currentTarget.closest<HTMLElement>("[data-page-canvas]"); if (!surface) return null; surface.setPointerCapture(event.pointerId); const box = surface.getBoundingClientRect(); return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }; };
  const startMove = (event: ReactPointerEvent<HTMLDivElement>, id: string) => { if (tool !== "select" || editingId === id) return; const start = capturePage(event); if (!start) return; pointerRef.current = { start, selectedId: id, mode: "move", before: { pages, annotations } }; };
  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => { event.stopPropagation(); const start = capturePage(event); if (!start) return; pointerRef.current = { start, selectedId: id, mode: "resize", before: { pages, annotations } }; };
  const rotateSelected = () => { if (!selectedId) return; commit(pages, annotations.map(annotation => annotation.id === selectedId ? { ...annotation, rotation: (annotation.rotation ?? 0) + 15 } : annotation)); };
  // Edits made through inputs are grouped into one undo step that starts with the first change.
  const updateAnnotation = (id: string, patch: Partial<Annotation>) => { if (!pendingEditRef.current) pendingEditRef.current = { pages, annotations }; setAnnotations(current => current.map(annotation => annotation.id === id ? { ...annotation, ...patch } : annotation)); };
  const updateSelected = (patch: Partial<Annotation>) => { if (selectedId) updateAnnotation(selectedId, patch); };
  const finalizeSelectedUpdate = () => { const before = pendingEditRef.current; if (!before) return; pendingEditRef.current = null; setHistory(current => addHistorySnapshot(current, before)); setFuture([]); };

  const editExistingLine = (line: TextLine, lineId: string, colors: { ink: string; paper: string }) => {
    if (!activePage) return;
    const pointsHigh = activePage.rotation % 180 ? activePage.width : activePage.height;
    const annotation: Annotation = {
      id: uid(), pageId: activePage.id, type: "text", replacesLine: lineId,
      x: line.x, y: Math.max(0, line.baseline - line.fontSize / pointsHigh), width: line.width, height: Math.max(line.height, line.fontSize * TEXT_LINE_HEIGHT / pointsHigh),
      text: line.text, color: colors.ink, opacity: 1, fontSize: line.fontSize, fontFamily: line.fontFamily, bold: line.bold, italic: line.italic,
      cover: { x: line.x, y: line.y, width: line.width, height: line.height, color: colors.paper },
    };
    createAnnotation(annotation);
    setEditingId(annotation.id);
  };

  const rotatePage = () => { if (!activePage) return; commit(pages.map(page => page.id === activePage.id ? { ...page, rotation: (page.rotation + 90) % 360 } : page), annotations); };
  const duplicatePage = () => { if (!activePage) return; const copy = { ...activePage, id: uid(), label: "Copy" }; const index = pages.findIndex(page => page.id === activePage.id); commit([...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)], annotations); setActivePageId(copy.id); };
  const deletePage = () => { if (!activePage || pages.length === 1) return toast.error("A document needs at least one page."); const index = pages.findIndex(page => page.id === activePage.id); const nextPages = pages.filter(page => page.id !== activePage.id); commit(nextPages, annotations.filter(annotation => annotation.pageId !== activePage.id), "Page deleted"); setActivePageId(nextPages[Math.max(0, index - 1)]?.id ?? null); };
  const addBlankPage = () => { const blank: EditorPage = { id: uid(), rotation: 0, width: 595, height: 842, label: "Blank page", blank: true }; commit([...pages, blank], annotations, "Blank page added"); setActivePageId(blank.id); };
  const reorder = (event: DragEndEvent) => { if (!event.over || event.active.id === event.over.id) return; const oldIndex = pages.findIndex(page => page.id === event.active.id); const newIndex = pages.findIndex(page => page.id === event.over?.id); commit(arrayMove(pages, oldIndex, newIndex), annotations); };
  const applyRedactions = () => { const count = annotations.filter(annotation => annotation.type === "redact" && annotation.status === "pending").length; if (!count) return toast.info("Mark an area before applying a redaction."); commit(pages, annotations.map(annotation => annotation.type === "redact" && annotation.status === "pending" ? { ...annotation, status: "applied" } : annotation), `${count} redaction${count === 1 ? "" : "s"} applied`); setRedactDialog(false); };
  const handleDownload = async (singlePage = false) => { if (!pages.length) return; setExporting(true); try { const bytes = await exportEditedPdf({ sources, pages, annotations, onlyPageId: singlePage ? activePageId ?? undefined : undefined }); triggerPdfDownload(bytes, `${fileName.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "edited-document"}${singlePage ? "-page" : "-edited"}.pdf`); toast.success(singlePage ? "Page extracted as a new PDF." : "Your edited PDF is ready."); } catch (error) { console.error("[PDF export]", error); toast.error(error instanceof Error ? error.message : "We could not export this PDF."); } finally { setExporting(false); } };

  const removeDocumentWatermarks = async () => {
    const usedSourceIds = new Set(pages.map(page => page.sourceId).filter(Boolean));
    setDocBusy(true);
    try {
      const replacements = new Map<string, SourceDocument>();
      let removed = 0;
      for (const source of sources.filter(source => usedSourceIds.has(source.id))) {
        const result = await removeWatermarks(source.bytes);
        if (!result.removed) continue;
        removed += result.removed;
        replacements.set(source.id, { id: uid(), name: source.name, bytes: result.bytes.slice().buffer });
      }
      if (!removed) {
        toast.info("No removable watermark found.", { description: "This PDF's watermark is drawn as ordinary page content. Cover it with Whiteout or the Eraser instead." });
        return;
      }
      // Keep the original sources so undo can bring the watermark back.
      setSources(current => [...current, ...Array.from(replacements.values())]);
      commit(pages.map(page => page.sourceId && replacements.has(page.sourceId) ? { ...page, sourceId: replacements.get(page.sourceId)!.id } : page), annotations, `Removed ${removed} watermark${removed === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not remove the watermark.");
    } finally { setDocBusy(false); }
  };

  const saveToLibrary = async () => {
    if (!pages.length || !sources.length) return;
    setSaveStatus("saving");
    try {
      const id = libraryId ?? uid();
      await saveLibraryDocument({ id, sources, pages, annotations, fileName, savedAt: Date.now() });
      if (user) await createAccountDocument.mutateAsync({ name: fileName.trim() || "Untitled document", originalFileName: `${fileName.trim() || "untitled-document"}.pdf`, pageCount: pages.length, byteSize: sources.reduce((total, source) => total + source.bytes.byteLength, 0) });
      setLibraryId(id); setSaveStatus("saved"); toast.success(user ? "Saved locally and added to your account activity." : "Saved privately to this device.");
    } catch { setSaveStatus("error"); toast.error("This browser could not save the session library entry."); }
  };
  const toggleDensity = () => { const next = toggleDashboardDensity(density); setDensity(next); saveDashboardDensity(window.localStorage, next); };
  const onInputFile = (event: ChangeEvent<HTMLInputElement>, mode: "replace" | "merge" = "replace") => { const file = event.target.files?.[0]; if (file) void loadPdf(file, mode); event.target.value = ""; };
  const onImageInput = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) return toast.error("Choose a PNG or JPEG image."); const reader = new FileReader(); reader.onload = () => { setImageDataUrl(String(reader.result)); setToolState("image"); toast.message("Image ready—click the PDF to place it."); }; reader.readAsDataURL(file); event.target.value = ""; };
  const chooseTool = (next: ToolName) => { setTool(next); if (next === "image") imageRef.current?.click(); };
  const zoomOut = () => setZoom(value => Math.max(.5, Number((value - .1).toFixed(2))));
  const zoomIn = () => setZoom(value => Math.min(2.5, Number((value + .1).toFixed(2))));

  if (!pages.length && !loading) return <EditorEmpty onBack={() => setLocation("/")} error={fileError} onFile={event => onInputFile(event)} recoverable={recoverable} onRestore={restoreSession} onDiscard={discardSession} />;

  const pageAnnotations = annotations.filter(annotation => annotation.pageId === activePage?.id);
  const toolPanelProps: ToolPanelProps = { tool, setTool: chooseTool, color, setColor, opacity, setOpacity, strokeWidth, setStrokeWidth, fill, setFill, fontSize, setFontSize, fontFamily, setFontFamily, bold, setBold, italic, setItalic, selected, updateSelected, finalizeUpdate: finalizeSelectedUpdate, deleteSelected, rotateSelected, signatureMode, setSignatureMode, signatureText, setSignatureText, onSignatureImage: () => signatureRef.current?.click(), onApplyRedactions: () => setRedactDialog(true), onMerge: () => mergeRef.current?.click(), onExtract: () => void handleDownload(true), onRemoveWatermark: () => void removeDocumentWatermarks(), docBusy, userName: user?.name };

  return <div data-dashboard-density={density} className="editor-shell h-screen overflow-hidden bg-[#eef2f7] text-[#172033]">
    <input ref={uploadRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => onInputFile(event)} /><input ref={mergeRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => onInputFile(event, "merge")} /><input ref={imageRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onImageInput} /><input ref={signatureRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onImageInput} />
    <header className="editor-header relative z-20 flex h-14 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/90 px-2 backdrop-blur-xl sm:px-3">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Back to home" className="h-8 w-8 shrink-0"><ChevronLeft className="h-4 w-4" /></Button>
        <button onClick={() => setLocation("/dashboard")} aria-label="Open your dashboard" className="shrink-0"><BrandMark size="sm" /></button>
        <label className="group flex min-w-0 items-center rounded-lg px-1.5 py-1 transition focus-within:bg-slate-50 focus-within:ring-2 focus-within:ring-[#326ad8]/25 hover:bg-slate-50">
          <span className="sr-only">Document name</span>
          <input value={fileName} onChange={event => setFileName(event.target.value)} onBlur={() => !fileName.trim() && setFileName("Untitled document")} onKeyDown={event => event.key === "Enter" && event.currentTarget.blur()} style={{ width: `${Math.min(Math.max(fileName.length, 6), 36) + 1}ch` }} className="min-w-0 max-w-[120px] truncate bg-transparent text-sm font-semibold outline-none sm:max-w-[260px] lg:max-w-[340px]" />
          <Pencil className="ml-1 h-3 w-3 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
        </label>
        <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider md:inline-flex ${saveStatus === "saved" ? "bg-emerald-50 text-emerald-700" : saveStatus === "saving" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${saveStatus === "saved" ? "bg-emerald-500" : saveStatus === "saving" ? "animate-pulse bg-amber-500" : "bg-red-500"}`} />{saveStatus === "saved" ? "Saved locally" : saveStatus === "saving" ? "Saving…" : "Save issue"}</span>
      </div>
      <div className="hidden items-center gap-0.5 rounded-xl border border-slate-200 bg-[#f8fafc] p-0.5 lg:flex">
        <HeaderButton icon={Undo2} label="Undo (Ctrl/Cmd + Z)" onClick={undo} disabled={!history.length} />
        <HeaderButton icon={Redo2} label="Redo (Ctrl/Cmd + Shift + Z)" onClick={redo} disabled={!future.length} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <HeaderButton icon={Maximize2} label="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.()} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={toggleDensity} aria-pressed={density === "compact"} aria-label={`Switch to ${density === "compact" ? "comfortable" : "compact"} density (Ctrl or Cmd + Shift + D)`} title={`${density === "compact" ? "Comfortable" : "Compact"} density · Ctrl/Cmd + Shift + D`} className="editor-density-toggle hidden h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-[#fbfcfe] px-2 text-[11px] font-semibold text-slate-600 transition hover:border-[#bcd6ff] hover:text-[#326ad8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#326ad8]/30 sm:inline-flex sm:px-2.5"><span className="grid h-5 w-5 place-items-center rounded-md bg-white text-[#326ad8] shadow-sm">{density === "compact" ? <Rows3 className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}</span><span className="hidden xl:inline">{density === "compact" ? "Comfortable" : "Compact"}</span></button>
        <Button variant="ghost" size="sm" onClick={() => setShowPagesOnMobile(value => !value)} aria-label="Show pages" className="md:hidden"><LayoutPanelLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => void handleDownload()} disabled={exporting} className="hidden rounded-lg sm:inline-flex">{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download</Button>
        <Button size="sm" onClick={() => void saveToLibrary()} disabled={saveStatus === "saving"} className="depth-btn rounded-lg bg-[#172033] text-white hover:bg-[#26334d]">{saveStatus === "saving" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save</Button>
      </div>
    </header>
    <div className="editor-workspace grid h-[calc(100vh-3.5rem)] grid-cols-[minmax(0,1fr)] md:grid-cols-[136px_minmax(0,1fr)_244px] lg:grid-cols-[176px_minmax(0,1fr)_288px]">
      <aside className={`${showPagesOnMobile ? "absolute inset-x-0 top-14 z-30 h-[calc(100vh-3.5rem)]" : "hidden"} min-h-0 border-r border-slate-200/80 bg-[#f8fafc] md:relative md:block md:h-full`}><PageRail pages={pages} sources={sources} activePageId={activePageId} onSelect={id => { setActivePageId(id); setSelectedId(null); setEditingId(null); setShowPagesOnMobile(false); }} sensors={sensors} onDragEnd={reorder} onRotate={rotatePage} onDuplicate={duplicatePage} onDelete={deletePage} onAdd={addBlankPage} /></aside>
      <div className="relative min-h-0 min-w-0">
        <main className="editor-canvas editor-canvas-bg relative h-full min-w-0 overflow-auto p-4 pb-36 md:p-8 md:pb-24">
          {activePage && <PdfPageSurface page={activePage} source={sources.find(source => source.id === activePage.sourceId)} annotations={pageAnnotations} selectedId={selectedId} editingId={editingId} tool={tool} zoom={zoom} fitMode={fitMode} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onSelect={setSelectedId} onMove={startMove} onResize={startResize} onStartEdit={id => { setSelectedId(id); setEditingId(id); }} onStopEdit={() => { setEditingId(null); finalizeSelectedUpdate(); }} onChangeText={(id, text) => updateAnnotation(id, { text })} onEditLine={editExistingLine} />}
        </main>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2 px-3 md:bottom-5">
          <div className="editor-nav pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-white/70 bg-white/90 p-1 shadow-[0_18px_40px_-18px_rgba(23,32,51,.45)] backdrop-blur-xl">
            <span className="lg:hidden"><HeaderButton icon={Undo2} label="Undo" onClick={undo} disabled={!history.length} /></span>
            <span className="lg:hidden"><HeaderButton icon={Redo2} label="Redo" onClick={redo} disabled={!future.length} /></span>
            <span className="mx-0.5 h-5 w-px bg-slate-200 lg:hidden" />
            <HeaderButton icon={ChevronLeft} label="Previous page" onClick={() => goToPage(-1)} disabled={activeIndex <= 0} />
            <span className="min-w-[48px] shrink-0 text-center text-xs font-semibold tabular-nums text-slate-600 sm:min-w-[72px]">{activeIndex + 1} / {pages.length}</span>
            <HeaderButton icon={ChevronRight} label="Next page" onClick={() => goToPage(1)} disabled={activeIndex >= pages.length - 1} />
            <span className="mx-0.5 h-5 w-px bg-slate-200" />
            <HeaderButton icon={ZoomOut} label="Zoom out" onClick={zoomOut} />
            <button type="button" onClick={() => setZoom(1)} title="Reset zoom" className="h-8 w-11 shrink-0 rounded-md text-center text-xs font-semibold tabular-nums text-slate-600 transition hover:bg-slate-100 sm:w-12">{Math.round(zoom * 100)}%</button>
            <HeaderButton icon={ZoomIn} label="Zoom in" onClick={zoomIn} />
            <span className="hidden sm:block"><HeaderButton icon={fitMode === "page" ? MoveHorizontal : Shrink} label={fitMode === "page" ? "Fit width" : "Fit page"} onClick={() => setFitMode(mode => mode === "page" ? "width" : "page")} /></span>
          </div>
          <div className="editor-mobile-tools pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/70 bg-white/90 p-1 shadow-[0_18px_40px_-18px_rgba(23,32,51,.45)] backdrop-blur-xl md:hidden">
            {toolMeta.map(item => <button key={item.tool} type="button" aria-label={item.label} aria-pressed={tool === item.tool} onClick={() => chooseTool(item.tool)} className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold transition ${tool === item.tool ? "bg-[#326ad8] text-white" : "text-slate-500"}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
            <button type="button" aria-label="Tool options" aria-expanded={showToolSheet} onClick={() => setShowToolSheet(true)} className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold text-[#326ad8]"><SlidersHorizontal className="h-4 w-4" />Options</button>
            <button type="button" aria-label="Download" onClick={() => void handleDownload()} className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 sm:hidden"><Download className="h-4 w-4" />Export</button>
          </div>
        </div>
      </div>
      <aside className="editor-tools hidden overflow-auto border-l border-slate-200/80 bg-white md:block"><ToolPanel {...toolPanelProps} /></aside>
    </div>
    {showToolSheet && <div className="fixed inset-0 z-40 md:hidden">
      <button type="button" aria-label="Close tool options" onClick={() => setShowToolSheet(false)} className="absolute inset-0 bg-[#172033]/35 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-label="Tool options" className="depth-rise absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-24px_60px_-20px_rgba(23,32,51,.45)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 pb-3 pt-2 backdrop-blur"><span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200" /><span className="mt-3 text-sm font-semibold">{metaFor(tool).label} options</span><button type="button" onClick={() => setShowToolSheet(false)} aria-label="Close" className="mt-2 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><X className="h-4 w-4" /></button></div>
        <ToolPanel {...toolPanelProps} hideTools />
      </div>
    </div>}
    {loading && pages.length === 0 && <div className="fixed inset-0 z-50 grid place-items-center bg-[#172033]/25 backdrop-blur-sm"><div className="rounded-2xl bg-white px-7 py-6 text-center shadow-xl"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#326ad8]" /><p className="mt-3 font-medium">{loadingText}</p><p className="mt-1 text-sm text-slate-500">This stays in your browser session.</p></div></div>}
    {redactDialog && <div className="fixed inset-0 z-50 grid place-items-center bg-[#172033]/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600"><ShieldAlert className="h-5 w-5" /></div><h2 className="mt-5 font-display text-xl font-semibold tracking-[-.035em]">Apply permanent redactions?</h2><p className="mt-3 text-sm leading-6 text-slate-600">Applied redactions flatten the selected areas when you export, removing the source content from the resulting PDF. This action cannot be undone in the exported file.</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setRedactDialog(false)}>Cancel</Button><Button className="bg-red-600 text-white hover:bg-red-700" onClick={applyRedactions}>Apply redactions</Button></div></div></div>}
  </div>;
}

function EditorEmpty({ onBack, error, onFile, recoverable, onRestore, onDiscard }: { onBack: () => void; error: string | null; onFile: (event: ChangeEvent<HTMLInputElement>) => void; recoverable: boolean; onRestore: () => void; onDiscard: () => void }) {
  return <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f7f9fc] p-5">
    <div className="depth-aurora" /><div className="depth-grid" />
    <input type="file" accept="application/pdf,.pdf" className="hidden" id="empty-upload" onChange={onFile} />
    <div className="depth-rise relative w-full max-w-xl rounded-[28px] border border-white bg-white/90 p-8 text-center shadow-[0_40px_80px_-40px_rgba(23,32,51,.45)] backdrop-blur sm:p-11">
      <div className="-mx-8 -mt-6 sm:-mx-11"><DocumentStack compact /></div>
      <p className="eyebrow">Private browser workspace</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.06em]">Open a PDF to start editing.</h1>
      <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">Your document is processed in this browser. Edit text, add annotations, organize pages, and export a new PDF when you are ready.</p>
      <label htmlFor="empty-upload" className="depth-btn mt-8 inline-flex cursor-pointer items-center rounded-xl bg-[#172033] px-5 py-3 text-sm font-semibold text-white hover:bg-[#26334d]"><Upload className="mr-2 h-4 w-4" />Choose a PDF</label>
      <button onClick={onBack} className="mt-4 block w-full text-sm font-medium text-slate-500 hover:text-[#172033]">Back to home</button>
      {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {recoverable && <div className="mt-8 rounded-2xl border border-[#bcd6ff] bg-[#f2f7ff] p-5 text-left"><p className="font-semibold">A local session is available</p><p className="mt-1 text-sm leading-6 text-slate-600">We found your last PDF and edits on this device. Restore it to continue where you left off.</p><div className="mt-4 flex gap-2"><Button size="sm" onClick={onRestore} className="bg-[#326ad8] text-white hover:bg-[#275cbf]">Restore session</Button><Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button></div></div>}
    </div>
  </div>;
}

function HeaderButton({ icon: Icon, label, onClick, disabled }: { icon: typeof Undo2; label: string; onClick: () => void; disabled?: boolean }) { return <Tooltip><TooltipTrigger asChild><button type="button" aria-label={label.replace(/ \(.*\)$/, "")} onClick={onClick} disabled={disabled} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 transition hover:bg-white hover:text-[#172033] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#326ad8] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:shadow-none"><Icon className="h-4 w-4" /></button></TooltipTrigger><TooltipContent side="bottom">{label}</TooltipContent></Tooltip>; }

function PageRail({ pages, sources, activePageId, onSelect, sensors, onDragEnd, onRotate, onDuplicate, onDelete, onAdd }: { pages: EditorPage[]; sources: SourceDocument[]; activePageId: string | null; onSelect: (id: string) => void; sensors: ReturnType<typeof useSensors>; onDragEnd: (event: DragEndEvent) => void; onRotate: () => void; onDuplicate: () => void; onDelete: () => void; onAdd: () => void }) {
  return <div className="editor-page-rail flex h-full min-h-0 flex-col">
    <div className="flex items-center justify-between px-3 py-3"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pages <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500 shadow-sm">{pages.length}</span></span><Button variant="ghost" size="icon" onClick={onAdd} title="Add blank page" aria-label="Add blank page" className="h-7 w-7 rounded-lg hover:bg-white"><Plus className="h-4 w-4" /></Button></div>
    <div className="mx-2 flex justify-between rounded-xl border border-slate-200 bg-white p-0.5"><HeaderButton icon={RotateCw} label="Rotate page" onClick={onRotate} /><HeaderButton icon={Copy} label="Duplicate page" onClick={onDuplicate} /><HeaderButton icon={Trash2} label="Delete page" onClick={onDelete} /></div>
    <div className="editor-page-scroll min-h-0 flex-1 overflow-y-scroll overscroll-contain px-3 py-3" aria-label="PDF pages. Scroll to access every page."><DndContext sensors={sensors} onDragEnd={onDragEnd}><SortableContext items={pages.map(page => page.id)} strategy={verticalListSortingStrategy}>{pages.map((page, index) => <PageThumb key={page.id} page={page} source={sources.find(source => source.id === page.sourceId)} index={index} active={page.id === activePageId} onSelect={() => onSelect(page.id)} />)}</SortableContext></DndContext></div>
    <div className="border-t border-slate-200/70 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">{pages.length} page{pages.length === 1 ? "" : "s"}</div>
  </div>;
}

function PageThumb({ page, source, index, active, onSelect }: { page: EditorPage; source?: SourceDocument; index: number; active: boolean; onSelect: () => void }) { const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id }); return <button ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} onClick={onSelect} aria-label={`Open page ${index + 1}`} className="group mb-4 block w-full text-left focus-visible:outline-none"><div className={`relative aspect-[.72] overflow-hidden rounded-md bg-white transition duration-300 group-focus-visible:ring-2 group-focus-visible:ring-[#326ad8] ${active ? "shadow-[0_0_0_2px_#326ad8,0_14px_24px_-12px_rgba(50,106,216,.55)]" : "shadow-[0_0_0_1px_rgba(23,32,51,.08),0_8px_16px_-12px_rgba(23,32,51,.4)] group-hover:-translate-y-0.5 group-hover:shadow-[0_0_0_1px_rgba(23,32,51,.12),0_14px_24px_-14px_rgba(23,32,51,.45)]"}`}><MiniPage page={page} source={source} /></div><span className={`mx-auto mt-1.5 block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold md:text-[11px] ${active ? "bg-[#326ad8] text-white" : "text-slate-500"}`}>{index + 1}</span></button>; }

function MiniPage({ page, source }: { page: EditorPage; source?: SourceDocument }) { const canvasRef = useRef<HTMLCanvasElement>(null); const holderRef = useRef<HTMLDivElement>(null); const [visible, setVisible] = useState(false); useEffect(() => { const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "160px" }); if (holderRef.current) observer.observe(holderRef.current); return () => observer.disconnect(); }, []); useEffect(() => { const controller = new AbortController(); const render = async () => { if (!visible || !source || page.sourceIndex === undefined || !canvasRef.current) return; const sourcePage = await getPdfPage(source, page.sourceIndex); await renderPdfPage(sourcePage, canvasRef.current, page.rotation, .35, controller.signal); }; void render().catch(() => undefined); return () => controller.abort(); }, [page.rotation, page.sourceIndex, source, visible]); return <div ref={holderRef} className="h-full w-full">{page.blank ? <div className="h-full w-full bg-white" /> : <canvas ref={canvasRef} className="h-full w-full object-contain" />}</div>; }

const textLineCache = new Map<string, Promise<TextLine[]>>();

type SurfaceProps = {
  page: EditorPage; source?: SourceDocument; annotations: Annotation[]; selectedId: string | null; editingId: string | null; tool: ToolName; zoom: number; fitMode: "width" | "page";
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSelect: (id: string | null) => void; onMove: (event: ReactPointerEvent<HTMLDivElement>, id: string) => void; onResize: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void;
  onStartEdit: (id: string) => void; onStopEdit: () => void; onChangeText: (id: string, text: string) => void;
  onEditLine: (line: TextLine, lineId: string, colors: { ink: string; paper: string }) => void;
};

function PdfPageSurface({ page, source, annotations, selectedId, editingId, tool, zoom, fitMode, onPointerDown, onPointerMove, onPointerUp, onSelect, onMove, onResize, onStartEdit, onStopEdit, onChangeText, onEditLine }: SurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [lines, setLines] = useState<TextLine[] | null>(null);
  const pointsWide = page.rotation % 180 ? page.height : page.width;

  useEffect(() => { const controller = new AbortController(); setRenderError(null); const render = async () => { if (!source || page.sourceIndex === undefined || !canvasRef.current) return; const sourcePage = await getPdfPage(source, page.sourceIndex); await renderPdfPage(sourcePage, canvasRef.current, page.rotation, 1.25 * Math.max(1, zoom), controller.signal); }; void render().catch(error => { if (!controller.signal.aborted) { console.error("[PDF render]", error); setRenderError("This page could not be previewed at full detail. Try rotating it or export the document after editing."); } }); return () => controller.abort(); }, [page.rotation, page.sourceIndex, source, zoom]);

  // Keep on-screen text the same physical size as the exported PDF: 1pt = surface width / page width.
  useEffect(() => {
    const element = surfaceRef.current; if (!element) return;
    const update = () => element.style.setProperty("--pt", String(element.getBoundingClientRect().width / pointsWide));
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, [pointsWide]);

  useEffect(() => {
    if (tool !== "edittext" || !source || page.sourceIndex === undefined) { setLines(page.blank && tool === "edittext" ? [] : null); return; }
    let cancelled = false;
    const key = `${source.id}:${page.sourceIndex}:${page.rotation}`;
    let pending = textLineCache.get(key);
    if (!pending) { pending = getPdfPage(source, page.sourceIndex).then(pdfPage => extractTextLines(pdfPage as unknown as Parameters<typeof extractTextLines>[0], page.rotation)); textLineCache.set(key, pending); pending.catch(() => textLineCache.delete(key)); }
    setLines(null);
    pending.then(result => { if (!cancelled) setLines(result); }).catch(() => { if (!cancelled) setLines([]); });
    return () => { cancelled = true; };
  }, [page.blank, page.rotation, page.sourceIndex, source, tool]);

  const replaced = new Set(annotations.map(annotation => annotation.replacesLine).filter(Boolean));
  const aspect = page.rotation % 180 ? page.height / page.width : page.width / page.height;
  const width = fitMode === "width" ? `${zoom * 100}%` : `calc(min(100%, (100vh - 240px) * ${aspect}) * ${zoom})`;
  const cursor = tool === "select" ? "cursor-default" : tool === "edittext" ? "cursor-text" : "cursor-crosshair";

  return <div className="min-h-full min-w-max py-6">
    <div style={{ width }} className="mx-auto">
      {tool === "edittext" && <div className="mb-3 flex justify-center"><span className="inline-flex items-center gap-2 rounded-full border border-[#cfe0ff] bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">{lines === null ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-[#326ad8]" />Finding text on this page…</> : lines.length ? <><TextCursorInput className="h-3.5 w-3.5 text-[#326ad8]" />Click any highlighted line to edit it</> : <><ShieldAlert className="h-3.5 w-3.5 text-amber-600" />No editable text here — it may be a scanned image. Use Whiteout + Add text.</>}</span></div>}
      <div ref={surfaceRef} data-page-canvas style={{ aspectRatio: String(aspect) }} className={`editor-paper relative w-full select-none overflow-hidden bg-white ${cursor}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {page.blank && <div className="absolute inset-0 bg-white" />}
        <AnnotationLayer annotations={annotations} selectedId={selectedId} editingId={editingId} tool={tool} onSelect={onSelect} onMove={onMove} onResize={onResize} onStartEdit={onStartEdit} onStopEdit={onStopEdit} onChangeText={onChangeText} />
        {tool === "edittext" && lines?.filter(line => !replaced.has(`${page.id}:${line.key}`)).map(line => <div key={line.key} role="button" tabIndex={0} aria-label={`Edit text: ${line.text}`} title={line.text}
          onPointerDown={event => { event.stopPropagation(); const colors = canvasRef.current ? sampleColors(canvasRef.current, line) : { ink: "#111111", paper: "#ffffff" }; onEditLine(line, `${page.id}:${line.key}`, colors); }}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); const colors = canvasRef.current ? sampleColors(canvasRef.current, line) : { ink: "#111111", paper: "#ffffff" }; onEditLine(line, `${page.id}:${line.key}`, colors); } }}
          className="edit-line-target absolute rounded-[2px]" style={{ left: `${line.x * 100}%`, top: `${line.y * 100}%`, width: `${line.width * 100}%`, height: `${line.height * 100}%` }} />)}
        {renderError && <div className="absolute inset-x-5 bottom-5 rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm leading-5 text-amber-900 shadow-sm">{renderError}</div>}
      </div>
    </div>
  </div>;
}

type LayerProps = { annotations: Annotation[]; selectedId: string | null; editingId: string | null; tool: ToolName; onSelect: (id: string) => void; onMove: (event: ReactPointerEvent<HTMLDivElement>, id: string) => void; onResize: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void; onStartEdit: (id: string) => void; onStopEdit: () => void; onChangeText: (id: string, text: string) => void };

function AnnotationLayer({ annotations, selectedId, editingId, tool, onSelect, onMove, onResize, onStartEdit, onStopEdit, onChangeText }: LayerProps) {
  return (
    <>
      {annotations.map(annotation => {
        const selected = annotation.id === selectedId;
        const common: CSSProperties = {
          position: "absolute",
          left: `${annotation.x * 100}%`,
          top: `${annotation.y * 100}%`,
          width: `${annotation.width * 100}%`,
          height: `${annotation.height * 100}%`,
          opacity: annotation.opacity ?? 1,
          transform: `rotate(${annotation.rotation ?? 0}deg)`,
          transformOrigin: "center",
        };
        const outline = selected ? "outline outline-[1.5px] outline-offset-2 outline-[#326ad8]" : "";
        const choose = (event: ReactPointerEvent<HTMLDivElement>) => {
          event.stopPropagation();
          onSelect(annotation.id);
          onMove(event, annotation.id);
        };

        if (annotation.type === "path" || annotation.type === "highlight" || (annotation.type === "whiteout" && annotation.points?.length)) {
          const points = annotation.points ?? [];
          const d = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
          const isWhiteout = annotation.type === "whiteout";
          const stroke = isWhiteout ? "#ffffff" : annotation.color;
          const strokeWidth = (annotation.strokeWidth ?? (isWhiteout ? 36 : 3)) / 1000;
          return <svg key={annotation.id} viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={isWhiteout ? { mixBlendMode: "normal" } : undefined}>{points.length === 1 ? <circle cx={points[0]!.x} cy={points[0]!.y} r={strokeWidth / 2} fill={stroke} opacity={isWhiteout ? 1 : annotation.opacity ?? 1} /> : <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={isWhiteout ? 1 : annotation.opacity ?? 1} />}</svg>;
        }
        if (annotation.type === "text" || annotation.type === "signature") {
          const editing = annotation.id === editingId;
          const textStyle: CSSProperties = { color: annotation.color, fontSize: `calc(var(--pt, 1) * ${annotation.fontSize ?? (annotation.type === "signature" ? 22 : 16)}px)`, fontFamily: cssFont(annotation), fontWeight: annotation.bold ? 700 : 400, fontStyle: annotation.italic || annotation.type === "signature" ? "italic" : "normal", textDecoration: annotation.underline ? "underline" : "none", lineHeight: TEXT_LINE_HEIGHT };
          const cover = annotation.cover;
          const onTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
            if (editing) { event.stopPropagation(); return; }
            choose(event);
            if (tool === "edittext" || tool === "text") onStartEdit(annotation.id);
          };
          const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey && annotation.replacesLine)) { event.preventDefault(); event.currentTarget.blur(); }
          };
          const lineCount = (annotation.text ?? "").split("\n");
          return <div key={annotation.id} className="contents">
            {cover && <div className="pointer-events-none absolute" style={{ left: `${cover.x * 100}%`, top: `${cover.y * 100}%`, width: `${cover.width * 100}%`, height: `${cover.height * 100}%`, background: cover.color }} />}
            <div style={{ ...common, ...textStyle }} onPointerDown={onTextPointerDown} onDoubleClick={() => onStartEdit(annotation.id)} className={`${editing ? "cursor-text" : tool === "select" ? "cursor-move" : "cursor-text"} whitespace-pre ${editing ? "" : outline} ${annotation.replacesLine && !selected && !editing ? "edited-text" : ""}`}>
              {editing
                ? <textarea autoFocus value={annotation.text ?? ""} onChange={event => onChangeText(annotation.id, event.target.value)} onBlur={onStopEdit} onKeyDown={onKeyDown} onFocus={event => event.currentTarget.select()} rows={lineCount.length} cols={Math.max(4, ...lineCount.map(line => line.length + 1))} spellCheck={false} className="editor-inline-text block min-w-full resize-none overflow-hidden whitespace-pre bg-white/70 p-0 outline-none ring-2 ring-[#326ad8] ring-offset-2" style={{ ...textStyle, fieldSizing: "content" } as CSSProperties} />
                : annotation.text}
              {selected && !editing && <AnnotationHandles id={annotation.id} onResize={onResize} />}
            </div>
          </div>;
        }
        if (annotation.type === "image" && annotation.dataUrl) {
          return <div key={annotation.id} style={common} onPointerDown={choose} className={`cursor-move ${outline}`}><img src={annotation.dataUrl} className="h-full w-full object-contain" />{selected && <AnnotationHandles id={annotation.id} onResize={onResize} />}</div>;
        }
        if (annotation.type === "whiteout" || annotation.type === "redact") {
          return <div key={annotation.id} style={{ ...common, background: annotation.type === "redact" && annotation.status === "applied" ? "#111827" : annotation.color || "#fff", border: annotation.type === "redact" && annotation.status !== "applied" ? "2px dashed #e15c4a" : undefined }} onPointerDown={choose} className={`cursor-move ${outline}`}>{annotation.type === "redact" && annotation.status === "applied" && <span className="absolute inset-0 grid place-items-center text-[7px] font-bold tracking-wider text-white">REDACTED</span>}{selected && <AnnotationHandles id={annotation.id} onResize={onResize} />}</div>;
        }
        return <div key={annotation.id} style={{ ...common, border: `${annotation.strokeWidth ?? 2}px solid ${annotation.color}`, background: annotation.fill === "transparent" ? "transparent" : annotation.fill, borderRadius: annotation.shape === "circle" ? "999px" : 0 }} onPointerDown={choose} className={`cursor-move ${outline}`}>{selected && <AnnotationHandles id={annotation.id} onResize={onResize} />}</div>;
      })}
    </>
  );
}

function AnnotationHandles({ id, onResize }: { id: string; onResize: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void }) { return <button aria-label="Resize selected object" onPointerDown={event => onResize(event, id)} className="absolute -bottom-2 -right-2 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-white bg-[#326ad8] shadow-[0_2px_6px_rgba(23,32,51,.35)]" />; }

type ToolPanelProps = { tool: ToolName; setTool: (tool: ToolName) => void; color: string; setColor: (value: string) => void; opacity: number; setOpacity: (value: number) => void; strokeWidth: number; setStrokeWidth: (value: number) => void; fill: string; setFill: (value: string) => void; fontSize: number; setFontSize: (value: number) => void; fontFamily: "Helvetica" | "TimesRoman" | "Courier"; setFontFamily: (value: "Helvetica" | "TimesRoman" | "Courier") => void; bold: boolean; setBold: (value: boolean) => void; italic: boolean; setItalic: (value: boolean) => void; selected: Annotation | null; updateSelected: (patch: Partial<Annotation>) => void; finalizeUpdate: () => void; deleteSelected: () => void; rotateSelected: () => void; signatureMode: "type" | "draw" | "upload"; setSignatureMode: (mode: "type" | "draw" | "upload") => void; signatureText: string; setSignatureText: (text: string) => void; onSignatureImage: () => void; onApplyRedactions: () => void; onMerge: () => void; onExtract: () => void; onRemoveWatermark: () => void; docBusy: boolean; userName?: string | null; hideTools?: boolean };

function ToolPanel({ hideTools = false, tool, setTool, color, setColor, opacity, setOpacity, strokeWidth, setStrokeWidth, fill, setFill, fontSize, setFontSize, fontFamily, setFontFamily, bold, setBold, italic, setItalic, selected, updateSelected, finalizeUpdate, deleteSelected, rotateSelected, signatureMode, setSignatureMode, signatureText, setSignatureText, onSignatureImage, onApplyRedactions, onMerge, onExtract, onRemoveWatermark, docBusy, userName }: ToolPanelProps) {
  const isText = tool === "text" || tool === "edittext" || selected?.type === "text";
  const meta = metaFor(tool);
  return <div className="editor-tool-panel flex min-h-full flex-col">
    {!hideTools && <div className="border-b border-slate-100 px-4 py-3.5"><p className="text-sm font-semibold">Tools</p><p className="mt-0.5 text-xs text-slate-500">Pick a tool, then work on the page.</p></div>}
    {!hideTools && <div className="space-y-3 border-b border-slate-100 p-3">
      {toolGroups.map(group => <div key={group.label}>
        <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{group.label}</p>
        <div className="grid grid-cols-2 gap-1.5">{group.tools.map(name => { const item = metaFor(name); const active = tool === name; return <button key={name} type="button" title={item.title ?? item.label} aria-pressed={active} onClick={() => setTool(name)} className={`editor-tool-tile group flex min-h-10 items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-xs font-semibold transition ${active ? "border-[#bcd3fb] bg-[#eef4ff] text-[#275cbf] shadow-[inset_0_1px_0_#fff,0_6px_14px_-10px_rgba(50,106,216,.7)]" : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-[#172033]"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${active ? "bg-[#326ad8] text-white shadow-[0_3px_0_#1f4aa3]" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm"}`}><item.icon className="h-3.5 w-3.5" /></span><span className="truncate">{item.label}</span></button>; })}</div>
      </div>)}
    </div>}
    <div className="flex-1 space-y-5 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{selected ? (selected.replacesLine ? "Edited text" : "Selected object") : meta.label}</p>
        {!selected && <p className="mt-1.5 text-xs leading-5 text-slate-500">{meta.hint}</p>}
        {selected && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={rotateSelected}><RotateCw className="mr-1.5 h-3.5 w-3.5" />Rotate</Button><Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={deleteSelected} aria-label={selected.replacesLine ? "Restore original text" : "Delete selected object"} title={selected.replacesLine ? "Restore original text" : "Delete"}>{selected.replacesLine ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}</Button></div>}
      </div>
      {tool === "edittext" && !selected && <div className="rounded-xl border border-[#d6e5ff] bg-[linear-gradient(160deg,#f7fbff,#eef4ff)] p-3 text-xs leading-5 text-slate-600"><p className="font-semibold text-[#172033]">How editing works</p><p className="mt-1">We cover the original line and type your new text on top, matching its size, color, and the closest standard font. Press Enter to finish, Esc to cancel focus.</p></div>}
      {isText && <><Field label="Text"><textarea value={selected?.text ?? ""} placeholder={tool === "edittext" ? "Click a line on the page" : "Text is placed on the page"} disabled={!selected} onChange={event => selected && updateSelected({ text: event.target.value })} onBlur={finalizeUpdate} className="min-h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#326ad8] disabled:bg-slate-50" /></Field><Field label="Font"><select value={selected?.fontFamily ?? fontFamily} onChange={event => { const value = event.target.value as "Helvetica" | "TimesRoman" | "Courier"; selected ? updateSelected({ fontFamily: value }) : setFontFamily(value); }} onBlur={finalizeUpdate} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="Helvetica">Sans (Helvetica)</option><option value="TimesRoman">Serif (Times)</option><option value="Courier">Mono (Courier)</option></select></Field><div className="grid grid-cols-2 gap-2"><Field label="Size"><input type="number" min="4" max="96" step="0.5" value={selected?.fontSize ?? fontSize} onChange={event => selected ? updateSelected({ fontSize: Number(event.target.value) }) : setFontSize(Number(event.target.value))} onBlur={finalizeUpdate} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></Field><div><p className="mb-2 text-xs font-medium text-slate-500">Style</p><div className="flex gap-1"><Button size="icon" variant={selected?.bold ?? bold ? "default" : "outline"} onClick={() => { if (selected) { updateSelected({ bold: !selected.bold }); finalizeUpdate(); } else setBold(!bold); }} className="h-9 w-9" aria-label="Bold"><b>B</b></Button><Button size="icon" variant={selected?.italic ?? italic ? "default" : "outline"} onClick={() => { if (selected) { updateSelected({ italic: !selected.italic }); finalizeUpdate(); } else setItalic(!italic); }} className="h-9 w-9" aria-label="Italic"><i>I</i></Button></div></div></div></>}
      <Field label="Color"><div className="flex gap-2"><input aria-label="Tool color" type="color" value={selected?.color ?? color} onChange={event => selected ? updateSelected({ color: event.target.value }) : setColor(event.target.value)} onBlur={finalizeUpdate} className="h-9 w-11 rounded-lg border border-slate-200 bg-white p-1" /><input value={selected?.color ?? color} onChange={event => selected ? updateSelected({ color: event.target.value }) : setColor(event.target.value)} onBlur={finalizeUpdate} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" /></div></Field>
      {["rectangle", "circle", "line", "arrow"].includes(tool) && <Field label="Fill"><select value={fill} onChange={event => setFill(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="transparent">None</option><option value="#eaf2ff">Soft blue</option><option value="#f7d79c">Warm yellow</option><option value="#172033">Ink</option></select></Field>}
      <Field label={`Opacity · ${Math.round((selected?.opacity ?? opacity) * 100)}%`}><input className="w-full accent-[#326ad8]" type="range" min=".1" max="1" step=".05" value={selected?.opacity ?? opacity} onChange={event => selected ? updateSelected({ opacity: Number(event.target.value) }) : setOpacity(Number(event.target.value))} onPointerUp={finalizeUpdate} /></Field>
      {["pen", "highlight", "eraser", "whiteout", "rectangle", "circle", "line", "arrow"].includes(tool) && <Field label={`Stroke · ${strokeWidth}px`}><input className="w-full accent-[#326ad8]" type="range" min="1" max="36" step="1" value={strokeWidth} onChange={event => setStrokeWidth(Number(event.target.value))} /></Field>}
      {tool === "signature" && <div className="space-y-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Signature method</p><div className="grid grid-cols-3 gap-1"><Choice active={signatureMode === "type"} onClick={() => setSignatureMode("type")} label="Type" /><Choice active={signatureMode === "draw"} onClick={() => setSignatureMode("draw")} label="Draw" /><Choice active={signatureMode === "upload"} onClick={() => { setSignatureMode("upload"); onSignatureImage(); }} label="Upload" /></div>{signatureMode === "type" && <input value={signatureText} placeholder={userName || "Signature"} onChange={event => setSignatureText(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />}<p className="text-xs leading-5 text-slate-500">{signatureMode === "draw" ? "Draw directly onto the document." : "Click the document to place your signature."}</p></div>}
      {tool === "redact" && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-800"><p className="font-semibold">Permanent action</p><p className="mt-1">Mark areas, then apply redactions before export.</p><Button size="sm" onClick={onApplyRedactions} className="mt-3 w-full bg-red-600 text-white hover:bg-red-700">Apply redactions</Button></div>}
      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Document</p>
        <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={onMerge} className="rounded-lg"><FileStack className="mr-1.5 h-3.5 w-3.5" />Merge PDF</Button><Button size="sm" variant="outline" onClick={onExtract} className="rounded-lg"><Scissors className="mr-1.5 h-3.5 w-3.5" />Extract page</Button></div>
        <Button size="sm" variant="outline" onClick={onRemoveWatermark} disabled={docBusy} className="mt-2 w-full justify-start rounded-lg">{docBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Stamp className="mr-1.5 h-3.5 w-3.5" />}Remove watermark</Button>
        <p className="mt-2 text-[11px] leading-4 text-slate-400">Removes watermarks marked as such in the PDF. Only remove watermarks from documents you have the right to edit.</p>
      </div>
    </div>
    <div className="border-t border-slate-100 p-4"><div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#326ad8]" />Guest document bytes stay in this browser session.</div></div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><p className="mb-2 text-xs font-medium text-slate-500">{label}</p>{children}</label>; }
function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`rounded-md px-2 py-1.5 text-xs font-medium ${active ? "bg-white text-[#326ad8] shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{label}</button>; }
