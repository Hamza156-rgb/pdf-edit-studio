import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Annotation, EditorPage, EditorSnapshot, Point, SourceDocument, ToolName } from "@/lib/editorTypes";
import { addHistorySnapshot, redoHistory, undoHistory } from "@/lib/editorHistory";
import { exportEditedPdf, getPdfPage, inspectPdf, triggerPdfDownload, validatePdfFile } from "@/lib/pdf";
import { clearEditorSession, loadEditorSession, saveEditorSession, saveLibraryDocument } from "@/lib/session";
import { consumeStagedEditorSession, consumeStagedPdfFile } from "@/lib/stagedFile";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowDownToLine, ArrowLeft, ArrowRight, BringToFront, Check, ChevronLeft, ChevronRight, Circle, Copy, Download, FileImage, FilePenLine, FilePlus2, FileStack, FileText, Highlighter, ImagePlus, LayoutPanelLeft, Loader2, LockKeyhole, Maximize2, Minus, MousePointer2, Move, Paintbrush, PanelRight, Pencil, Plus, Redo2, RotateCcw, RotateCw, Save, Scissors, Search, ShieldAlert, Signature, Square, Trash2, Undo2, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { ChangeEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const uid = () => crypto.randomUUID();
const toolMeta: { tool: ToolName; label: string; icon: typeof MousePointer2 }[] = [
  { tool: "select", label: "Select", icon: MousePointer2 }, { tool: "text", label: "Text", icon: FileText }, { tool: "pen", label: "Draw", icon: Pencil }, { tool: "highlight", label: "Highlight", icon: Highlighter }, { tool: "eraser", label: "Eraser", icon: Paintbrush }, { tool: "whiteout", label: "Whiteout", icon: Square }, { tool: "redact", label: "Redact", icon: ShieldAlert }, { tool: "rectangle", label: "Rectangle", icon: Square }, { tool: "circle", label: "Circle", icon: Circle }, { tool: "line", label: "Line", icon: Minus }, { tool: "arrow", label: "Arrow", icon: ArrowRight }, { tool: "image", label: "Image", icon: ImagePlus }, { tool: "signature", label: "Sign", icon: Signature },
];

type PointerDraft = { start: Point; annotationId?: string; mode: "draw" | "shape" | "move" | "resize"; selectedId?: string; before?: EditorSnapshot };

export default function PdfEditor() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const pendingFile = useMemo(() => consumeStagedPdfFile(), []);
  const pendingSession = useMemo(() => consumeStagedEditorSession(), []);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [pages, setPages] = useState<EditorPage[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [fileName, setFileName] = useState("Untitled document");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolName>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [loading, setLoading] = useState(Boolean(pendingFile));
  const [loadingText, setLoadingText] = useState("Preparing your PDF…");
  const [fileError, setFileError] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState(false);
  const [redactDialog, setRedactDialog] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<"type" | "draw" | "upload">("type");
  const [signatureText, setSignatureText] = useState("Signature");
  const [showPagesOnMobile, setShowPagesOnMobile] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<"width" | "page">("page");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [libraryId, setLibraryId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const mergeRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);
  const pointerRef = useRef<PointerDraft | null>(null);
  const annotationRef = useRef({ pages, annotations });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => { annotationRef.current = { pages, annotations }; }, [pages, annotations]);

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
        setSources([source]); setPages(sourcePages); setAnnotations([]); setHistory([]); setFuture([]); setFileName(file.name.replace(/\.pdf$/i, "")); setActivePageId(sourcePages[0]?.id ?? null);
      } else {
        commit([...pages, ...sourcePages], annotations, `${sourcePages.length} page${sourcePages.length === 1 ? "" : "s"} added`); setSources(current => [...current, source]);
      }
    } catch (error) { setFileError(error instanceof Error ? error.message : "We could not open this document."); }
    finally { setLoading(false); }
  }, [annotations, commit, pages]);

  useEffect(() => {
    if (pendingSession) {
      setSources(pendingSession.sources); setPages(pendingSession.pages); setAnnotations(pendingSession.annotations); setFileName(pendingSession.fileName); setActivePageId(pendingSession.pages[0]?.id ?? null); setLibraryId((pendingSession as typeof pendingSession & { id?: string }).id ?? null);
    } else if (pendingFile) {
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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void handleDownload(); }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) { event.preventDefault(); deleteSelected(); }
      if (event.key === "Escape") { setSelectedId(null); setTool("select"); }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const currentIndex = pages.findIndex(page => page.id === activePageId);
        const targetPage = pages[currentIndex + (event.key === "ArrowLeft" ? -1 : 1)];
        if (targetPage) { event.preventDefault(); setActivePageId(targetPage.id); setSelectedId(null); }
      }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  });

  const restoreSession = async () => {
    const session = await loadEditorSession();
    if (!session) return setRecoverable(false);
    setSources(session.sources); setPages(session.pages); setAnnotations(session.annotations); setFileName(session.fileName); setActivePageId(session.pages[0]?.id ?? null); setRecoverable(false); toast.success("Your local editing session is back.");
  };
  const discardSession = async () => { await clearEditorSession(); setRecoverable(false); };
  const undo = () => { const result = undoHistory(history, { pages, annotations }, future); if (!result) return; setFuture(result.future); setPages(result.current.pages); setAnnotations(result.current.annotations); setHistory(result.history); setSelectedId(null); };
  const redo = () => { const result = redoHistory(history, { pages, annotations }, future); if (!result) return; setHistory(result.history); setPages(result.current.pages); setAnnotations(result.current.annotations); setFuture(result.future); setSelectedId(null); };
  const deleteSelected = () => { if (!selectedId) return; commit(pages, annotations.filter(annotation => annotation.id !== selectedId)); setSelectedId(null); };
  const selected = annotations.find(annotation => annotation.id === selectedId) ?? null;
  const activePage = pages.find(page => page.id === activePageId) ?? null;

  const getPoint = (event: ReactPointerEvent<HTMLDivElement>): Point => { const box = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) }; };
  const newShapeType = (candidate: ToolName): Annotation["shape"] => candidate === "circle" ? "circle" : candidate === "line" ? "line" : candidate === "arrow" ? "arrow" : "rectangle";
  const createAnnotation = (annotation: Annotation) => { commit(pages, [...annotations, annotation]); setSelectedId(annotation.id); };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePage) return;
    const point = getPoint(event);
    if (tool === "select") { setSelectedId(null); return; }
    if (tool === "text") { const annotation: Annotation = { id: uid(), pageId: activePage.id, type: "text", x: point.x, y: point.y, width: .28, height: .065, text: "Type here", color, opacity, fontSize, fontFamily, bold, italic }; createAnnotation(annotation); return; }
    if (tool === "signature" && signatureMode === "type") { const annotation: Annotation = { id: uid(), pageId: activePage.id, type: "signature", x: point.x, y: point.y, width: .25, height: .08, text: signatureText || "Signature", color: "#172033", opacity: 1, fontSize: 22 }; createAnnotation(annotation); return; }
    if ((tool === "image" || (tool === "signature" && signatureMode === "upload")) && imageDataUrl) { const annotation: Annotation = { id: uid(), pageId: activePage.id, type: "image", x: point.x, y: point.y, width: .24, height: .18, dataUrl: imageDataUrl, opacity: 1 }; createAnnotation(annotation); return; }
    if (["pen", "highlight", "eraser"].includes(tool) || (tool === "signature" && signatureMode === "draw")) {
      const type: Annotation["type"] = tool === "highlight" ? "highlight" : tool === "eraser" ? "whiteout" : "path";
      const annotation: Annotation = { id: uid(), pageId: activePage.id, type, x: 0, y: 0, width: 1, height: 1, points: [point], color: tool === "highlight" ? "#f4c84a" : tool === "eraser" ? "#ffffff" : tool === "signature" ? "#172033" : color, opacity: tool === "highlight" ? .42 : opacity, strokeWidth: tool === "signature" ? 3 : strokeWidth };
      setAnnotations(current => [...current, annotation]); setSelectedId(annotation.id); pointerRef.current = { start: point, annotationId: annotation.id, mode: "draw", before: { pages, annotations } }; event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    if (["whiteout", "redact", "rectangle", "circle", "line", "arrow"].includes(tool)) { pointerRef.current = { start: point, mode: "shape" }; event.currentTarget.setPointerCapture(event.pointerId); }
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = pointerRef.current; if (!draft || !activePage) return; const point = getPoint(event);
    if (draft.mode === "draw" && draft.annotationId) setAnnotations(current => current.map(annotation => annotation.id === draft.annotationId ? { ...annotation, points: [...(annotation.points ?? []), point] } : annotation));
    if (draft.mode === "move" && draft.selectedId) { const dx = point.x - draft.start.x; const dy = point.y - draft.start.y; const initial = annotations.find(annotation => annotation.id === draft.selectedId); if (!initial) return; setAnnotations(current => current.map(annotation => annotation.id === draft.selectedId ? { ...annotation, x: Math.max(0, Math.min(1 - annotation.width, initial.x + dx)), y: Math.max(0, Math.min(1 - annotation.height, initial.y + dy)) } : annotation)); }
    if (draft.mode === "resize" && draft.selectedId) { const initial = annotations.find(annotation => annotation.id === draft.selectedId); if (!initial) return; setAnnotations(current => current.map(annotation => annotation.id === draft.selectedId ? { ...annotation, width: Math.max(.03, Math.min(1 - annotation.x, initial.width + point.x - draft.start.x)), height: Math.max(.02, Math.min(1 - annotation.y, initial.height + point.y - draft.start.y)) } : annotation)); }
  };

  const onCanvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = pointerRef.current; if (!draft || !activePage) return; const end = getPoint(event); pointerRef.current = null;
    if (draft.mode === "draw" || draft.mode === "move" || draft.mode === "resize") { if (draft.before) setHistory(current => addHistorySnapshot(current, draft.before!)); setFuture([]); return; }
    if (draft.mode === "shape") { const x = Math.min(draft.start.x, end.x); const y = Math.min(draft.start.y, end.y); const width = Math.max(.01, Math.abs(end.x - draft.start.x)); const height = Math.max(.01, Math.abs(end.y - draft.start.y)); const annotation: Annotation = tool === "whiteout" ? { id: uid(), pageId: activePage.id, type: "whiteout", x, y, width, height, color: "#ffffff" } : tool === "redact" ? { id: uid(), pageId: activePage.id, type: "redact", x, y, width, height, status: "pending" } : { id: uid(), pageId: activePage.id, type: "shape", x, y, width, height, color, fill, opacity, strokeWidth, shape: newShapeType(tool) };
      createAnnotation(annotation); }
  };

  const startMove = (event: ReactPointerEvent<HTMLDivElement>, id: string) => { if (tool !== "select") return; event.stopPropagation(); const point = getPoint(event); pointerRef.current = { start: point, selectedId: id, mode: "move", before: { pages, annotations } }; event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(id); };
  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => { event.stopPropagation(); const box = event.currentTarget.closest("[data-page-canvas]")?.getBoundingClientRect(); if (!box) return; pointerRef.current = { start: { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }, selectedId: id, mode: "resize", before: { pages, annotations } }; event.currentTarget.setPointerCapture(event.pointerId); };
  const rotateSelected = () => { if (!selectedId) return; commit(pages, annotations.map(annotation => annotation.id === selectedId ? { ...annotation, rotation: (annotation.rotation ?? 0) + 15 } : annotation)); };
  const updateSelected = (patch: Partial<Annotation>) => { if (!selectedId) return; setAnnotations(current => current.map(annotation => annotation.id === selectedId ? { ...annotation, ...patch } : annotation)); };
  const finalizeSelectedUpdate = () => { setHistory(current => addHistorySnapshot(current, { pages, annotations })); setFuture([]); };

  const rotatePage = () => { if (!activePage) return; commit(pages.map(page => page.id === activePage.id ? { ...page, rotation: (page.rotation + 90) % 360 } : page), annotations); };
  const duplicatePage = () => { if (!activePage) return; const copy = { ...activePage, id: uid(), label: "Copy" }; const index = pages.findIndex(page => page.id === activePage.id); commit([...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)], annotations); setActivePageId(copy.id); };
  const deletePage = () => { if (!activePage || pages.length === 1) return toast.error("A document needs at least one page."); const index = pages.findIndex(page => page.id === activePage.id); const nextPages = pages.filter(page => page.id !== activePage.id); commit(nextPages, annotations.filter(annotation => annotation.pageId !== activePage.id), "Page deleted"); setActivePageId(nextPages[Math.max(0, index - 1)]?.id ?? null); };
  const addBlankPage = () => { const blank: EditorPage = { id: uid(), rotation: 0, width: 595, height: 842, label: "Blank page", blank: true }; commit([...pages, blank], annotations, "Blank page added"); setActivePageId(blank.id); };
  const reorder = (event: DragEndEvent) => { if (!event.over || event.active.id === event.over.id) return; const oldIndex = pages.findIndex(page => page.id === event.active.id); const newIndex = pages.findIndex(page => page.id === event.over?.id); commit(arrayMove(pages, oldIndex, newIndex), annotations); };
  const applyRedactions = () => { const count = annotations.filter(annotation => annotation.type === "redact" && annotation.status === "pending").length; if (!count) return toast.info("Mark an area before applying a redaction."); commit(pages, annotations.map(annotation => annotation.type === "redact" && annotation.status === "pending" ? { ...annotation, status: "applied" } : annotation), `${count} redaction${count === 1 ? "" : "s"} applied`); setRedactDialog(false); };
  const handleDownload = async (singlePage = false) => { if (!pages.length) return; setExporting(true); try { const bytes = await exportEditedPdf({ sources, pages, annotations, onlyPageId: singlePage ? activePageId ?? undefined : undefined }); triggerPdfDownload(bytes, `${fileName.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "edited-document"}${singlePage ? "-page" : "-edited"}.pdf`); toast.success(singlePage ? "Page extracted as a new PDF." : "Your edited PDF is ready."); } catch (error) { console.error("[PDF export]", error); toast.error(error instanceof Error ? error.message : "We could not export this PDF."); } finally { setExporting(false); } };
  const saveToLibrary = async () => {
    if (!pages.length || !sources.length) return;
    setSaveStatus("saving");
    try {
      const id = libraryId ?? uid();
      await saveLibraryDocument({ id, sources, pages, annotations, fileName, savedAt: Date.now() });
      setLibraryId(id); setSaveStatus("saved"); toast.success("Saved privately to this device.");
    } catch { setSaveStatus("error"); toast.error("This browser could not save the session library entry."); }
  };
  const onInputFile = (event: ChangeEvent<HTMLInputElement>, mode: "replace" | "merge" = "replace") => { const file = event.target.files?.[0]; if (file) void loadPdf(file, mode); event.target.value = ""; };
  const onImageInput = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) return toast.error("Choose a PNG or JPEG image."); const reader = new FileReader(); reader.onload = () => { setImageDataUrl(String(reader.result)); setTool("image"); toast.message("Image ready—click the PDF to place it."); }; reader.readAsDataURL(file); event.target.value = ""; };

  if (!pages.length && !loading) return <EditorEmpty onChoose={() => uploadRef.current?.click()} onBack={() => setLocation("/")} error={fileError} onFile={event => onInputFile(event)} recoverable={recoverable} onRestore={restoreSession} onDiscard={discardSession} />;

  return <div className="h-screen overflow-hidden bg-[#edf1f6] text-[#172033]">
    <input ref={uploadRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => onInputFile(event)} /><input ref={mergeRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => onInputFile(event, "merge")} /><input ref={imageRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onImageInput} /><input ref={signatureRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onImageInput} />
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm"><div className="flex min-w-0 items-center gap-2"><Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Back to home"><ChevronLeft className="h-4 w-4" /></Button><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#172033] text-white"><FilePenLine className="h-4 w-4" /></span><button onClick={() => setLocation("/dashboard")} className="max-w-[150px] truncate text-left text-sm font-semibold sm:max-w-[260px]">{fileName}.pdf</button><span className={`hidden rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider md:inline ${saveStatus === "saved" ? "bg-emerald-50 text-emerald-700" : saveStatus === "saving" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{saveStatus === "saved" ? "Saved locally" : saveStatus === "saving" ? "Saving…" : "Save issue"}</span></div><div className="hidden items-center gap-1 lg:flex"><HeaderButton icon={Undo2} label="Undo" onClick={undo} disabled={!history.length} /><HeaderButton icon={Redo2} label="Redo" onClick={redo} disabled={!future.length} /><span className="mx-1 h-5 w-px bg-slate-200" /><HeaderButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom(value => Math.max(.6, Number((value - .1).toFixed(2))))} /><HeaderButton icon={Maximize2} label={fitMode === "page" ? "Fit width" : "Fit page"} onClick={() => setFitMode(mode => mode === "page" ? "width" : "page")} /><span className="w-10 text-center text-[11px] font-semibold text-slate-500">{Math.round(zoom * 100)}%</span><HeaderButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom(value => Math.min(2.5, Number((value + .1).toFixed(2))))} /><span className="mx-1 h-5 w-px bg-slate-200" /><HeaderButton icon={Maximize2} label="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.()} /></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => setShowPagesOnMobile(value => !value)} className="md:hidden"><LayoutPanelLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => void handleDownload()} disabled={exporting} className="hidden rounded-lg sm:inline-flex">{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download</Button><Button size="sm" onClick={() => void saveToLibrary()} disabled={saveStatus === "saving"} className="rounded-lg bg-[#172033] text-white hover:bg-[#26334d]">{saveStatus === "saving" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save</Button></div></header>
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[72px_minmax(0,1fr)] md:grid-cols-[188px_minmax(0,1fr)_270px]">
      <aside className={`${showPagesOnMobile ? "absolute inset-x-0 top-14 z-30 h-[calc(100vh-3.5rem)]" : "hidden"} border-r border-slate-200 bg-white md:relative md:block md:h-auto`}><PageRail pages={pages} sources={sources} activePageId={activePageId} onSelect={id => { setActivePageId(id); setSelectedId(null); setShowPagesOnMobile(false); }} sensors={sensors} onDragEnd={reorder} onRotate={rotatePage} onDuplicate={duplicatePage} onDelete={deletePage} onAdd={addBlankPage} /></aside>
      <main className="relative min-w-0 overflow-auto bg-[#edf1f6] p-4 md:p-8"><div className="absolute left-3 top-3 z-10 flex gap-1 lg:hidden"><HeaderButton icon={Undo2} label="Undo" onClick={undo} disabled={!history.length} /><HeaderButton icon={Redo2} label="Redo" onClick={redo} disabled={!future.length} /></div>{activePage && <PdfPageSurface page={activePage} source={sources.find(source => source.id === activePage.sourceId)} annotations={annotations.filter(annotation => annotation.pageId === activePage.id)} selectedId={selectedId} tool={tool} zoom={zoom} fitMode={fitMode} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onSelect={setSelectedId} onMove={startMove} onResize={startResize} />}</main>
      <aside className="hidden overflow-auto border-l border-slate-200 bg-white md:block"><ToolPanel tool={tool} setTool={setTool} color={color} setColor={setColor} opacity={opacity} setOpacity={setOpacity} strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth} fill={fill} setFill={setFill} fontSize={fontSize} setFontSize={setFontSize} fontFamily={fontFamily} setFontFamily={setFontFamily} bold={bold} setBold={setBold} italic={italic} setItalic={setItalic} selected={selected} updateSelected={updateSelected} finalizeUpdate={finalizeSelectedUpdate} deleteSelected={deleteSelected} rotateSelected={rotateSelected} onImage={() => imageRef.current?.click()} signatureMode={signatureMode} setSignatureMode={setSignatureMode} signatureText={signatureText} setSignatureText={setSignatureText} onSignatureImage={() => signatureRef.current?.click()} onApplyRedactions={() => setRedactDialog(true)} onMerge={() => mergeRef.current?.click()} onExtract={() => void handleDownload(true)} userName={user?.name} /></aside>
    </div>
    {loading && <div className="fixed inset-0 z-50 grid place-items-center bg-[#172033]/25 backdrop-blur-sm"><div className="rounded-2xl bg-white px-7 py-6 text-center shadow-xl"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#326ad8]" /><p className="mt-3 font-medium">{loadingText}</p><p className="mt-1 text-sm text-slate-500">This stays in your browser session.</p></div></div>}
    {redactDialog && <div className="fixed inset-0 z-50 grid place-items-center bg-[#172033]/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600"><ShieldAlert className="h-5 w-5" /></div><h2 className="mt-5 font-display text-xl font-semibold tracking-[-.035em]">Apply permanent redactions?</h2><p className="mt-3 text-sm leading-6 text-slate-600">Applied redactions flatten the selected areas when you export, removing the source content from the resulting PDF. This action cannot be undone in the exported file.</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setRedactDialog(false)}>Cancel</Button><Button className="bg-red-600 text-white hover:bg-red-700" onClick={applyRedactions}>Apply redactions</Button></div></div></div>}
  </div>;
}

function EditorEmpty({ onChoose, onBack, error, onFile, recoverable, onRestore, onDiscard }: { onChoose: () => void; onBack: () => void; error: string | null; onFile: (event: ChangeEvent<HTMLInputElement>) => void; recoverable: boolean; onRestore: () => void; onDiscard: () => void }) { return <div className="grid min-h-screen place-items-center bg-[#f7f9fc] p-5"><input type="file" accept="application/pdf,.pdf" className="hidden" id="empty-upload" onChange={onFile} /><div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-11"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#172033] text-white"><FilePenLine className="h-6 w-6" /></span><p className="eyebrow mt-7">Private browser workspace</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.06em]">Open a PDF to start editing.</h1><p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">Your document is processed in this browser. Add annotations, organize pages, and export a new PDF when you are ready.</p><label htmlFor="empty-upload" className="mt-8 inline-flex cursor-pointer items-center rounded-xl bg-[#172033] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#26334d]"><Upload className="mr-2 h-4 w-4" />Choose a PDF</label><button onClick={onBack} className="mt-4 block w-full text-sm font-medium text-slate-500 hover:text-[#172033]">Back to home</button>{error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{recoverable && <div className="mt-8 rounded-2xl border border-[#bcd6ff] bg-[#f2f7ff] p-5 text-left"><p className="font-semibold">A local session is available</p><p className="mt-1 text-sm leading-6 text-slate-600">We found your last PDF and edits on this device. Restore it to continue where you left off.</p><div className="mt-4 flex gap-2"><Button size="sm" onClick={onRestore} className="bg-[#326ad8] text-white hover:bg-[#275cbf]">Restore session</Button><Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button></div></div>}</div></div>; }

function HeaderButton({ icon: Icon, label, onClick, disabled }: { icon: typeof Undo2; label: string; onClick: () => void; disabled?: boolean }) { return <Tooltip><TooltipTrigger asChild><button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#326ad8] disabled:cursor-not-allowed disabled:opacity-35"><Icon className="h-4 w-4" /></button></TooltipTrigger><TooltipContent side="bottom">{label}</TooltipContent></Tooltip>; }

function PageRail({ pages, sources, activePageId, onSelect, sensors, onDragEnd, onRotate, onDuplicate, onDelete, onAdd }: { pages: EditorPage[]; sources: SourceDocument[]; activePageId: string | null; onSelect: (id: string) => void; sensors: ReturnType<typeof useSensors>; onDragEnd: (event: DragEndEvent) => void; onRotate: () => void; onDuplicate: () => void; onDelete: () => void; onAdd: () => void }) { return <div className="flex h-full flex-col"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-3"><span className="hidden text-xs font-bold uppercase tracking-wider text-slate-500 md:block">Pages</span><Button variant="ghost" size="icon" onClick={onAdd} title="Add blank page" className="h-7 w-7"><Plus className="h-4 w-4" /></Button></div><div className="flex gap-1 border-b border-slate-100 px-2 py-2"><HeaderButton icon={RotateCw} label="Rotate page" onClick={onRotate} /><HeaderButton icon={Copy} label="Duplicate page" onClick={onDuplicate} /><HeaderButton icon={Trash2} label="Delete page" onClick={onDelete} /></div><div className="min-h-0 flex-1 overflow-y-auto px-2 py-3"><DndContext sensors={sensors} onDragEnd={onDragEnd}><SortableContext items={pages.map(page => page.id)} strategy={verticalListSortingStrategy}>{pages.map((page, index) => <PageThumb key={page.id} page={page} source={sources.find(source => source.id === page.sourceId)} index={index} active={page.id === activePageId} onSelect={() => onSelect(page.id)} />)}</SortableContext></DndContext></div></div>; }

function PageThumb({ page, source, index, active, onSelect }: { page: EditorPage; source?: SourceDocument; index: number; active: boolean; onSelect: () => void }) { const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id }); return <button ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} onClick={onSelect} aria-label={`Open page ${index + 1}`} className={`mb-3 w-full rounded-lg p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#326ad8] ${active ? "bg-[#eaf2ff] ring-1 ring-[#326ad8]" : "hover:bg-slate-50"}`}><div className="relative aspect-[.72] overflow-hidden rounded border border-slate-200 bg-white"><MiniPage page={page} source={source} /></div><span className="mt-1 block truncate px-1 text-[10px] font-semibold text-slate-500 md:text-xs">{index + 1}</span></button>; }

function MiniPage({ page, source }: { page: EditorPage; source?: SourceDocument }) { const canvasRef = useRef<HTMLCanvasElement>(null); const holderRef = useRef<HTMLDivElement>(null); const [visible, setVisible] = useState(false); useEffect(() => { const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "160px" }); if (holderRef.current) observer.observe(holderRef.current); return () => observer.disconnect(); }, []); useEffect(() => { let cancelled = false; const render = async () => { if (!visible || !source || page.sourceIndex === undefined || !canvasRef.current) return; const sourcePage = await getPdfPage(source, page.sourceIndex); const viewport = sourcePage.getViewport({ scale: .35, rotation: page.rotation }); const canvas = canvasRef.current; canvas.width = viewport.width; canvas.height = viewport.height; const context = canvas.getContext("2d"); if (context && !cancelled) await sourcePage.render({ canvas, canvasContext: context, viewport }).promise; }; void render().catch(() => undefined); return () => { cancelled = true; }; }, [page.rotation, page.sourceIndex, source, visible]); return <div ref={holderRef} className="h-full w-full">{page.blank ? <div className="h-full w-full bg-white" /> : <canvas ref={canvasRef} className="h-full w-full object-contain" />}</div>; }

function PdfPageSurface({ page, source, annotations, selectedId, tool, zoom, fitMode, onPointerDown, onPointerMove, onPointerUp, onSelect, onMove, onResize }: { page: EditorPage; source?: SourceDocument; annotations: Annotation[]; selectedId: string | null; tool: ToolName; zoom: number; fitMode: "width" | "page"; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void; onSelect: (id: string | null) => void; onMove: (event: ReactPointerEvent<HTMLDivElement>, id: string) => void; onResize: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void }) { const canvasRef = useRef<HTMLCanvasElement>(null); useEffect(() => { let cancelled = false; const render = async () => { if (!source || page.sourceIndex === undefined || !canvasRef.current) return; const sourcePage = await getPdfPage(source, page.sourceIndex); const viewport = sourcePage.getViewport({ scale: 1.7, rotation: page.rotation }); const canvas = canvasRef.current; canvas.width = viewport.width; canvas.height = viewport.height; const context = canvas.getContext("2d"); if (context && !cancelled) await sourcePage.render({ canvas, canvasContext: context, viewport }).promise; }; void render().catch(() => toast.error("A PDF page could not be rendered.")); return () => { cancelled = true; }; }, [page.rotation, page.sourceIndex, source]); const aspect = page.rotation % 180 ? page.height / page.width : page.width / page.height; const width = fitMode === "width" ? `${zoom * 100}%` : `calc(min(100%, (100vh - 170px) * ${aspect}) * ${zoom})`; return <div className="min-h-full min-w-max py-8"><div style={{ width }} className="mx-auto"><div data-page-canvas style={{ aspectRatio: String(aspect) }} className={`relative w-full select-none overflow-hidden bg-white shadow-[0_16px_50px_-16px_rgba(23,32,51,.28)] ${tool !== "select" ? "cursor-crosshair" : "cursor-default"}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}><canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />{page.blank && <div className="absolute inset-0 bg-white" />}<AnnotationLayer annotations={annotations} selectedId={selectedId} tool={tool} onSelect={onSelect} onMove={onMove} onResize={onResize} /></div></div></div>; }

function AnnotationLayer({ annotations, selectedId, onSelect, onMove, onResize }: { annotations: Annotation[]; selectedId: string | null; tool: ToolName; onSelect: (id: string) => void; onMove: (event: ReactPointerEvent<HTMLDivElement>, id: string) => void; onResize: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void }) {
  return (
    <>
      {annotations.map(annotation => {
        const selected = annotation.id === selectedId;
        const common = {
          position: "absolute" as const,
          left: `${annotation.x * 100}%`,
          top: `${annotation.y * 100}%`,
          width: `${annotation.width * 100}%`,
          height: `${annotation.height * 100}%`,
          opacity: annotation.opacity ?? 1,
          transform: `rotate(${annotation.rotation ?? 0}deg)`,
          transformOrigin: "center",
        };
        const choose = (event: ReactPointerEvent<HTMLDivElement>) => {
          event.stopPropagation();
          onSelect(annotation.id);
          onMove(event, annotation.id);
        };

        if (annotation.type === "path" || annotation.type === "highlight" || (annotation.type === "whiteout" && annotation.points?.length)) {
          const d = (annotation.points ?? []).map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
          return <svg key={annotation.id} viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"><path d={d} fill="none" stroke={annotation.color} strokeWidth={(annotation.strokeWidth ?? 3) / 1000} strokeLinecap="round" strokeLinejoin="round" opacity={annotation.opacity ?? 1} /></svg>;
        }
        if (annotation.type === "text" || annotation.type === "signature") {
          return <div key={annotation.id} style={{ ...common, color: annotation.color, fontSize: `min(${annotation.fontSize ?? 16}px, 3.4vw)`, fontFamily: annotation.type === "signature" ? "'Instrument Serif', serif" : annotation.fontFamily === "Courier" ? "monospace" : annotation.fontFamily === "TimesRoman" ? "serif" : "sans-serif", fontWeight: annotation.bold ? 700 : 400, fontStyle: annotation.italic || annotation.type === "signature" ? "italic" : "normal", textDecoration: annotation.underline ? "underline" : "none", lineHeight: 1.15 }} onPointerDown={choose} className={`cursor-move whitespace-pre-wrap px-1 py-0.5 ${selected ? "outline outline-1 outline-[#326ad8]" : ""}`}>{annotation.text}{selected && <AnnotationHandles id={annotation.id} onResize={onResize} />}</div>;
        }
        if (annotation.type === "image" && annotation.dataUrl) {
          return <div key={annotation.id} style={common} onPointerDown={choose} className={`cursor-move ${selected ? "outline outline-1 outline-[#326ad8]" : ""}`}><img src={annotation.dataUrl} className="h-full w-full object-contain" />{selected && <AnnotationHandles id={annotation.id} onResize={onResize} />}</div>;
        }
        if (annotation.type === "whiteout" || annotation.type === "redact") {
          return <div key={annotation.id} style={{ ...common, background: annotation.type === "redact" && annotation.status === "applied" ? "#111827" : annotation.color || "#fff", border: annotation.type === "redact" && annotation.status !== "applied" ? "2px dashed #e15c4a" : undefined }} onPointerDown={choose} className={`cursor-move ${selected ? "outline outline-1 outline-[#326ad8]" : ""}`}>{annotation.type === "redact" && annotation.status === "applied" && <span className="absolute inset-0 grid place-items-center text-[7px] font-bold tracking-wider text-white">REDACTED</span>}{selected && <AnnotationHandles id={annotation.id} onResize={onResize} />}</div>;
        }
        return <div key={annotation.id} style={{ ...common, border: `${annotation.strokeWidth ?? 2}px solid ${annotation.color}`, background: annotation.fill === "transparent" ? "transparent" : annotation.fill, borderRadius: annotation.shape === "circle" ? "999px" : 0 }} onPointerDown={choose} className={`cursor-move ${selected ? "outline outline-1 outline-[#326ad8]" : ""}`}>{selected && <AnnotationHandles id={annotation.id} onResize={onResize} />}</div>;
      })}
    </>
  );
}

function AnnotationHandles({ id, onResize }: { id: string; onResize: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void }) { return <button aria-label="Resize selected object" onPointerDown={event => onResize(event, id)} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-sm border border-white bg-[#326ad8] shadow-sm" />; }

function ToolPanel({ tool, setTool, color, setColor, opacity, setOpacity, strokeWidth, setStrokeWidth, fill, setFill, fontSize, setFontSize, fontFamily, setFontFamily, bold, setBold, italic, setItalic, selected, updateSelected, finalizeUpdate, deleteSelected, rotateSelected, onImage, signatureMode, setSignatureMode, signatureText, setSignatureText, onSignatureImage, onApplyRedactions, onMerge, onExtract, userName }: { tool: ToolName; setTool: (tool: ToolName) => void; color: string; setColor: (value: string) => void; opacity: number; setOpacity: (value: number) => void; strokeWidth: number; setStrokeWidth: (value: number) => void; fill: string; setFill: (value: string) => void; fontSize: number; setFontSize: (value: number) => void; fontFamily: "Helvetica" | "TimesRoman" | "Courier"; setFontFamily: (value: "Helvetica" | "TimesRoman" | "Courier") => void; bold: boolean; setBold: (value: boolean) => void; italic: boolean; setItalic: (value: boolean) => void; selected: Annotation | null; updateSelected: (patch: Partial<Annotation>) => void; finalizeUpdate: () => void; deleteSelected: () => void; rotateSelected: () => void; onImage: () => void; signatureMode: "type" | "draw" | "upload"; setSignatureMode: (mode: "type" | "draw" | "upload") => void; signatureText: string; setSignatureText: (text: string) => void; onSignatureImage: () => void; onApplyRedactions: () => void; onMerge: () => void; onExtract: () => void; userName?: string | null }) { const isText = tool === "text" || selected?.type === "text"; return <div className="flex min-h-full flex-col"><div className="border-b border-slate-100 px-4 py-4"><div className="flex items-center gap-2"><PanelRight className="h-4 w-4 text-[#326ad8]" /><span className="text-sm font-semibold">Tools</span></div></div><div className="grid grid-cols-4 gap-1 border-b border-slate-100 p-3">{toolMeta.map(item => <button key={item.tool} title={item.label} onClick={() => { setTool(item.tool); if (item.tool === "image") onImage(); }} className={`grid aspect-square place-items-center rounded-lg transition ${tool === item.tool ? "bg-[#eaf2ff] text-[#326ad8]" : "text-slate-500 hover:bg-slate-100 hover:text-[#172033]"}`}><item.icon className="h-4 w-4" /><span className="sr-only">{item.label}</span></button>)}</div><div className="flex-1 space-y-5 p-4"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{selected ? "Selected object" : toolMeta.find(item => item.tool === tool)?.label ?? "Tool"}</p>{selected && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={rotateSelected}><RotateCw className="mr-1.5 h-3.5 w-3.5" />Rotate</Button><Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={deleteSelected}><Trash2 className="h-3.5 w-3.5" /></Button></div>}</div>{isText && <><Field label="Text"><textarea value={selected?.text ?? ""} placeholder="Text is placed on the page" onChange={event => selected && updateSelected({ text: event.target.value })} onBlur={finalizeUpdate} className="min-h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#326ad8]" /></Field><Field label="Font"><select value={selected?.fontFamily ?? fontFamily} onChange={event => { const value = event.target.value as "Helvetica" | "TimesRoman" | "Courier"; selected ? updateSelected({ fontFamily: value }) : setFontFamily(value); }} onBlur={finalizeUpdate} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="Helvetica">Sans</option><option value="TimesRoman">Serif</option><option value="Courier">Mono</option></select></Field><div className="grid grid-cols-2 gap-2"><Field label="Size"><input type="number" min="8" max="96" value={selected?.fontSize ?? fontSize} onChange={event => selected ? updateSelected({ fontSize: Number(event.target.value) }) : setFontSize(Number(event.target.value))} onBlur={finalizeUpdate} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></Field><div><p className="mb-2 text-xs font-medium text-slate-500">Style</p><div className="flex gap-1"><Button size="icon" variant={selected?.bold ?? bold ? "default" : "outline"} onClick={() => selected ? updateSelected({ bold: !selected.bold }) : setBold(!bold)} className="h-9 w-9"><b>B</b></Button><Button size="icon" variant={selected?.italic ?? italic ? "default" : "outline"} onClick={() => selected ? updateSelected({ italic: !selected.italic }) : setItalic(!italic)} className="h-9 w-9"><i>I</i></Button></div></div></div></>}<Field label="Color"><div className="flex gap-2"><input aria-label="Tool color" type="color" value={selected?.color ?? color} onChange={event => selected ? updateSelected({ color: event.target.value }) : setColor(event.target.value)} onBlur={finalizeUpdate} className="h-9 w-11 rounded border border-slate-200 bg-white p-1" /><input value={selected?.color ?? color} onChange={event => selected ? updateSelected({ color: event.target.value }) : setColor(event.target.value)} onBlur={finalizeUpdate} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" /></div></Field>{["rectangle", "circle", "line", "arrow"].includes(tool) && <Field label="Fill"><select value={fill} onChange={event => setFill(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="transparent">None</option><option value="#eaf2ff">Soft blue</option><option value="#f7d79c">Warm yellow</option><option value="#172033">Ink</option></select></Field>}<Field label={`Opacity · ${Math.round((selected?.opacity ?? opacity) * 100)}%`}><input className="w-full accent-[#326ad8]" type="range" min=".1" max="1" step=".05" value={selected?.opacity ?? opacity} onChange={event => selected ? updateSelected({ opacity: Number(event.target.value) }) : setOpacity(Number(event.target.value))} onMouseUp={finalizeUpdate} /></Field>{["pen", "highlight", "eraser", "whiteout", "rectangle", "circle", "line", "arrow"].includes(tool) && <Field label={`Stroke · ${strokeWidth}px`}><input className="w-full accent-[#326ad8]" type="range" min="1" max="36" step="1" value={strokeWidth} onChange={event => setStrokeWidth(Number(event.target.value))} /></Field>}{tool === "signature" && <div className="space-y-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Signature method</p><div className="grid grid-cols-3 gap-1"><Choice active={signatureMode === "type"} onClick={() => setSignatureMode("type")} label="Type" /><Choice active={signatureMode === "draw"} onClick={() => setSignatureMode("draw")} label="Draw" /><Choice active={signatureMode === "upload"} onClick={() => { setSignatureMode("upload"); onSignatureImage(); }} label="Upload" /></div>{signatureMode === "type" && <input value={signatureText} placeholder={userName || "Signature"} onChange={event => setSignatureText(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />}<p className="text-xs leading-5 text-slate-500">{signatureMode === "draw" ? "Draw directly onto the document." : "Click the document to place your signature."}</p></div>}{tool === "redact" && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-800"><p className="font-semibold">Permanent action</p><p className="mt-1">Mark areas, then apply redactions before export.</p><Button size="sm" onClick={onApplyRedactions} className="mt-3 w-full bg-red-600 text-white hover:bg-red-700">Apply redactions</Button></div>}<div className="border-t border-slate-100 pt-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Pages</p><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={onMerge}><FileStack className="mr-1.5 h-3.5 w-3.5" />Merge PDF</Button><Button size="sm" variant="outline" onClick={onExtract}><Scissors className="mr-1.5 h-3.5 w-3.5" />Extract page</Button></div></div></div><div className="border-t border-slate-100 p-4"><div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#326ad8]" />Guest document bytes stay in this browser session.</div></div></div>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><p className="mb-2 text-xs font-medium text-slate-500">{label}</p>{children}</label>; }
function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`rounded-md px-2 py-1.5 text-xs font-medium ${active ? "bg-white text-[#326ad8] shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{label}</button>; }
