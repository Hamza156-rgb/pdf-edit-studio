import { App as CapacitorApp } from "@capacitor/app";
import { useAuth } from "@/_core/hooks/useAuth";
import { BrandMark, DocumentStack, TiltCard } from "@/components/Depth";
import { deliverPdf, haptic, isNative, setFlag, setStatusBar } from "@/lib/native";
import { exportEditedPdf, getPdfPage, renderPdfPage, triggerPdfDownload, validatePdfFile } from "@/lib/pdf";
import { deleteLibraryDocument, LibraryDocumentSummary, listLibraryDocuments, loadLibraryDocument, renameLibraryDocument } from "@/lib/session";
import { stageEditorSession, stagePdfFile } from "@/lib/stagedFile";
import { trpc } from "@/lib/trpc";
import { ChevronRight, CloudOff, FileText, FolderOpen, Highlighter, Home, Info, LayoutGrid, Loader2, LogIn, LogOut, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Share2, ShieldAlert, ShieldCheck, Signature, Sparkles, Stamp, TextCursorInput, Trash2, UserRound, X } from "lucide-react";
import { ChangeEvent, CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Opens the system file picker, then the editor with an optional starting tool or action. */
function usePdfPicker() {
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const intent = useRef("");
  const open = useCallback((query = "") => { haptic("light"); intent.current = query; inputRef.current?.click(); }, []);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validatePdfFile(file);
    if (problem) { haptic("warning"); toast.error(problem); return; }
    stagePdfFile(file);
    setLocation(`/editor${intent.current}`);
  };
  const input = <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onChange} />;
  return { open, input };
}

function useLibrary() {
  const [documents, setDocuments] = useState<LibraryDocumentSummary[] | null>(null);
  const refresh = useCallback(async () => {
    try { setDocuments(await listLibraryDocuments()); } catch { setDocuments([]); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { documents, refresh };
}

const documentSize = (document: LibraryDocumentSummary) => document.sources.reduce((total, source) => total + source.bytes.byteLength, 0);
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const relativeDate = (time: number) => {
  const days = Math.floor((Date.now() - time) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : new Date(time).toLocaleDateString();
};

function DocThumb({ document, className = "" }: { document: LibraryDocumentSummary; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const page = document.pages[0];
    const source = document.sources.find(item => item.id === page?.sourceId);
    if (!page || !source || page.sourceIndex === undefined || !canvasRef.current) { setFailed(true); return; }
    const controller = new AbortController();
    void getPdfPage(source, page.sourceIndex).then(pdfPage => renderPdfPage(pdfPage, canvasRef.current!, page.rotation, .3, controller.signal)).catch(() => setFailed(true));
    return () => controller.abort();
  }, [document]);
  return (
    <span className={`relative block overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgba(23,32,51,.08),0_10px_18px_-10px_rgba(23,32,51,.45)] ${className}`}>
      {failed ? <span className="grid h-full w-full place-items-center bg-[#eef4ff] text-[#326ad8]"><FileText className="h-5 w-5" /></span> : <canvas ref={canvasRef} className="h-full w-full object-cover object-top" />}
    </span>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#0f172a]/45 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-label={title} className="depth-rise app-safe-bottom absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-5 pb-4 pt-2 shadow-[0_-24px_60px_-20px_rgba(15,23,42,.5)]">
        <span className="mx-auto block h-1 w-10 rounded-full bg-slate-200" />
        <div className="mt-3 flex items-center justify-between"><h2 className="truncate pr-3 font-display text-lg font-semibold tracking-[-.03em]">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><X className="h-4 w-4" /></button></div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function SheetAction({ icon: Icon, label, tone = "default", onClick }: { icon: typeof Pencil; label: string; tone?: "default" | "danger"; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`app-press flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left text-[15px] font-medium active:bg-slate-50 ${tone === "danger" ? "text-red-600" : "text-[#172033]"}`}><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone === "danger" ? "bg-red-50" : "bg-slate-100"}`}><Icon className="h-5 w-5" /></span>{label}</button>;
}

/** Open / share / rename / delete for a library document. */
function useDocumentActions(refresh: () => Promise<void>) {
  const [, setLocation] = useLocation();
  const [active, setActive] = useState<LibraryDocumentSummary | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = () => { setActive(null); setRenaming(null); setConfirmDelete(false); };

  const openDocument = async (id: string) => {
    haptic("light");
    const document = await loadLibraryDocument(id);
    if (!document) return toast.error("That document is no longer on this device.");
    stageEditorSession(document);
    setLocation("/editor");
  };
  const share = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const document = await loadLibraryDocument(active.id);
      if (!document) throw new Error("missing");
      const bytes = await exportEditedPdf(document);
      await deliverPdf(bytes, `${document.fileName || "document"}.pdf`, triggerPdfDownload);
      close();
    } catch { toast.error("We couldn't export that document."); }
    finally { setBusy(false); }
  };
  const rename = async () => {
    if (!active || !renaming?.trim()) return;
    await renameLibraryDocument(active.id, renaming.trim());
    haptic("success"); close(); await refresh();
  };
  const remove = async () => {
    if (!active) return;
    await deleteLibraryDocument(active.id);
    haptic("medium"); close(); await refresh(); toast.success("Document removed from this device.");
  };

  const sheet = active && (
    <Sheet title={renaming !== null ? "Rename document" : confirmDelete ? "Delete this document?" : active.fileName} onClose={close}>
      {renaming !== null ? (
        <form onSubmit={event => { event.preventDefault(); void rename(); }} className="space-y-3">
          <input autoFocus value={renaming} onChange={event => setRenaming(event.target.value)} enterKeyHint="done" className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-[15px] outline-none focus:border-[#326ad8] focus:ring-4 focus:ring-[#326ad8]/10" />
          <button type="submit" className="app-press w-full rounded-2xl bg-[#172033] py-3.5 font-semibold text-white">Save name</button>
        </form>
      ) : confirmDelete ? (
        <div>
          <p className="text-[15px] leading-6 text-slate-600">This removes the document and its edits from this device. It can't be undone.</p>
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="app-press rounded-2xl bg-slate-100 py-3.5 font-semibold">Cancel</button><button type="button" onClick={() => void remove()} className="app-press rounded-2xl bg-red-600 py-3.5 font-semibold text-white">Delete</button></div>
        </div>
      ) : (
        <div className="-mx-1">
          <SheetAction icon={FolderOpen} label="Open in editor" onClick={() => void openDocument(active.id)} />
          <SheetAction icon={busy ? Loader2 : Share2} label={busy ? "Preparing PDF…" : isNative() ? "Share or save PDF" : "Download PDF"} onClick={() => void share()} />
          <SheetAction icon={Pencil} label="Rename" onClick={() => setRenaming(active.fileName)} />
          <SheetAction icon={Trash2} label="Delete" tone="danger" onClick={() => { haptic("warning"); setConfirmDelete(true); }} />
        </div>
      )}
    </Sheet>
  );
  return { openDocument, showActions: (document: LibraryDocumentSummary) => { haptic("light"); setActive(document); }, sheet };
}

function DocumentRow({ document, onOpen, onMore }: { document: LibraryDocumentSummary; onOpen: () => void; onMore: () => void }) {
  return (
    <div className="flex items-center gap-3.5 py-3">
      <button type="button" onClick={onOpen} className="app-press flex min-w-0 flex-1 items-center gap-3.5 text-left">
        <DocThumb document={document} className="h-[60px] w-[46px] shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-[#172033]">{document.fileName}</span>
          <span className="mt-1 block text-[13px] text-slate-500">{document.pages.length} page{document.pages.length === 1 ? "" : "s"} · {formatBytes(documentSize(document))} · {relativeDate(document.savedAt)}</span>
        </span>
      </button>
      <button type="button" onClick={onMore} aria-label={`More actions for ${document.fileName}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 active:bg-slate-100"><MoreHorizontal className="h-5 w-5" /></button>
    </div>
  );
}

function TabScreen({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  useEffect(() => { setStatusBar("light"); }, []);
  return (
    <div className="app-screen min-h-[100dvh] bg-[#f5f7fb] text-[#172033]">
      <header className="app-safe-top sticky top-0 z-20 bg-[#f5f7fb]/85 px-5 pb-3 backdrop-blur-xl">
        <div className="flex items-end justify-between pt-3"><div><p className="text-[13px] font-medium text-slate-500">{subtitle}</p><h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-.05em]">{title}</h1></div>{action}</div>
      </header>
      <main className="px-5 pb-36">{children}</main>
      <TabBar />
    </div>
  );
}

function TabBar() {
  const [location, setLocation] = useLocation();
  const picker = usePdfPicker();
  const tabs = [{ path: "/", label: "Home", icon: Home }, { path: "/library", label: "Library", icon: LayoutGrid }, { path: "/account", label: "Account", icon: UserRound }];
  const go = (path: string) => { if (path !== location) { haptic("light"); setLocation(path); } };
  return (
    <nav aria-label="Main" className="app-tabbar fixed inset-x-0 bottom-0 z-30 px-4">
      {picker.input}
      <div className="relative mx-auto flex max-w-md items-center justify-around rounded-[26px] border border-white/80 bg-white/85 px-2 py-1.5 shadow-[0_20px_44px_-18px_rgba(15,23,42,.45)] backdrop-blur-xl">
        {tabs.slice(0, 2).map(tab => <TabButton key={tab.path} {...tab} active={location === tab.path} onClick={() => go(tab.path)} />)}
        <button type="button" onClick={() => picker.open()} aria-label="Open a PDF" className="app-fab -mt-9 grid h-16 w-16 place-items-center rounded-[22px] text-white"><Plus className="h-7 w-7" strokeWidth={2.5} /></button>
        {tabs.slice(2).map(tab => <TabButton key={tab.path} {...tab} active={location === tab.path} onClick={() => go(tab.path)} />)}
        <span className="w-0" />
      </div>
    </nav>
  );
}

function TabButton({ label, icon: Icon, active, onClick }: { label: string; icon: typeof Home; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-semibold transition ${active ? "text-[#326ad8]" : "text-slate-400"}`}><Icon className={`h-[22px] w-[22px] transition ${active ? "-translate-y-0.5 scale-110" : ""}`} strokeWidth={active ? 2.4 : 2} />{label}</button>;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

const quickTools = [
  { label: "Edit text", query: "?tool=edittext", icon: TextCursorInput, from: "#4c84ee", to: "#2457c0", edge: "#173f94" },
  { label: "Sign", query: "?tool=signature", icon: Signature, from: "#8a74f0", to: "#5f45d6", edge: "#43309f" },
  { label: "Highlight", query: "?tool=highlight", icon: Highlighter, from: "#f2b84b", to: "#d9901a", edge: "#9c6408" },
  { label: "Redact", query: "?tool=redact", icon: ShieldAlert, from: "#f07272", to: "#d64545", edge: "#9f2f2f" },
  { label: "Watermark", query: "?action=watermark", icon: Stamp, from: "#34b47f", to: "#1c8a5f", edge: "#126044" },
  { label: "Pages", query: "?action=pages", icon: LayoutGrid, from: "#3a4b70", to: "#22304d", edge: "#0b1120" },
];

export function HomeTab() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const picker = usePdfPicker();
  const { documents, refresh } = useLibrary();
  const actions = useDocumentActions(refresh);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0];

  return (
    <TabScreen title={firstName ? `Hi, ${firstName}` : "Welcome"} subtitle={greeting} action={<button type="button" onClick={() => setLocation("/account")} aria-label="Account" className="app-press grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-bold text-[#326ad8] shadow-[0_2px_0_rgba(23,32,51,.06),0_10px_20px_-12px_rgba(23,32,51,.4)]">{user?.name?.slice(0, 1).toUpperCase() ?? <UserRound className="h-5 w-5" />}</button>}>
      {picker.input}
      <TiltCard max={7} className="relative mt-2 overflow-hidden rounded-[28px] bg-[#172033] p-6 text-white shadow-[0_30px_50px_-28px_rgba(23,32,51,.8)]">
        <div className="depth-grid depth-grid-dark" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#326ad8]/45 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-14 w-[210px] opacity-90"><DocumentStack compact /></div>
        <div className="relative max-w-[60%]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#cfe0ff]"><Sparkles className="h-3 w-3" />Private editor</span>
          <h2 className="depth-pop mt-4 font-display text-[1.55rem] font-semibold leading-[1.1] tracking-[-.045em]">Open a PDF and start editing.</h2>
        </div>
        <button type="button" onClick={() => picker.open()} className="app-press depth-pop relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-[#172033] shadow-[0_3px_0_#c7d4ea,0_16px_26px_-14px_rgba(0,0,0,.7)]"><FileText className="h-4 w-4" />Choose a PDF</button>
      </TiltCard>

      {!user && (
        <button type="button" onClick={() => setLocation("/signup")} className="app-press mt-4 flex w-full items-center gap-3 rounded-2xl border border-[#d6e5ff] bg-[linear-gradient(150deg,#f7fbff,#eaf2ff)] p-4 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#326ad8] text-white shadow-[0_3px_0_#1f4aa3]"><CloudOff className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">You're using Editly as a guest</span><span className="block text-[13px] text-slate-500">Create a free account to keep document activity.</span></span>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>
      )}

      <section className="mt-7">
        <h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">Quick tools</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {quickTools.map(tool => (
            <TiltCard key={tool.label} max={12} glare={false} className="rounded-[22px]">
              <button type="button" onClick={() => picker.open(tool.query)} className="app-press flex w-full flex-col items-center gap-2.5 rounded-[22px] border border-white bg-white px-2 pb-3.5 pt-4 shadow-[0_14px_26px_-20px_rgba(23,32,51,.55)]">
                <span className="depth-icon h-12 w-12" style={{ background: `linear-gradient(145deg, ${tool.from}, ${tool.to})`, "--icon-edge": tool.edge } as CSSProperties}><tool.icon className="h-5 w-5" /></span>
                <span className="text-[12px] font-semibold text-[#172033]">{tool.label}</span>
              </button>
            </TiltCard>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between"><h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">Recent</h2>{documents && documents.length > 3 && <button type="button" onClick={() => setLocation("/library")} className="text-sm font-semibold text-[#326ad8]">See all</button>}</div>
        <div className="mt-2 rounded-[24px] bg-white px-4 shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
          {documents === null ? <div className="grid h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            : documents.length ? <div className="divide-y divide-slate-100">{documents.slice(0, 3).map(document => <DocumentRow key={document.id} document={document} onOpen={() => void actions.openDocument(document.id)} onMore={() => actions.showActions(document)} />)}</div>
              : <p className="py-8 text-center text-sm leading-6 text-slate-500">Documents you save from the editor<br />will appear here.</p>}
        </div>
      </section>
      {actions.sheet}
    </TabScreen>
  );
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function LibraryTab() {
  const picker = usePdfPicker();
  const { documents, refresh } = useLibrary();
  const actions = useDocumentActions(refresh);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const visible = useMemo(() => (documents ?? [])
    .filter(document => document.fileName.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "name" ? a.fileName.localeCompare(b.fileName) : b.savedAt - a.savedAt), [documents, query, sort]);

  return (
    <TabScreen title="Library" subtitle={documents ? `${documents.length} document${documents.length === 1 ? "" : "s"} on this device` : "Loading…"}>
      {picker.input}
      <div className="flex gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 shadow-[inset_0_1px_2px_rgba(23,32,51,.05)] focus-within:border-[#326ad8] focus-within:ring-4 focus-within:ring-[#326ad8]/10"><Search className="h-5 w-5 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} type="search" enterKeyHint="search" placeholder="Search documents" aria-label="Search documents" className="app-input" /></label>
        <button type="button" onClick={() => { haptic("light"); setSort(value => value === "recent" ? "name" : "recent"); }} className="app-press h-12 shrink-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">{sort === "recent" ? "Recent" : "A–Z"}</button>
      </div>

      {documents === null ? <div className="grid h-60 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        : visible.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3.5">
            {visible.map(document => (
              <TiltCard key={document.id} max={9} className="rounded-[22px]">
                <div className="rounded-[22px] bg-white p-3 shadow-[0_16px_30px_-22px_rgba(23,32,51,.55)]">
                  <button type="button" onClick={() => void actions.openDocument(document.id)} className="app-press block w-full text-left">
                    <DocThumb document={document} className="aspect-[.78] w-full" />
                    <span className="mt-3 block truncate text-sm font-semibold">{document.fileName}</span>
                  </button>
                  <div className="mt-0.5 flex items-center justify-between"><span className="text-xs text-slate-500">{relativeDate(document.savedAt)}</span><button type="button" onClick={() => actions.showActions(document)} aria-label={`More actions for ${document.fileName}`} className="-mr-2 grid h-9 w-9 place-items-center rounded-full text-slate-400 active:bg-slate-100"><MoreHorizontal className="h-5 w-5" /></button></div>
                </div>
              </TiltCard>
            ))}
          </div>
        ) : (
          <div className="mt-6 text-center">
            <div className="mx-auto -mb-6 h-[210px] max-w-[300px]"><DocumentStack compact /></div>
            <h2 className="font-display text-xl font-semibold tracking-[-.04em]">{query ? "No matches" : "Your library is empty"}</h2>
            <p className="mx-auto mt-2 max-w-[260px] text-sm leading-6 text-slate-500">{query ? "Try a different name." : "Open a PDF, make your edits, and tap Save to keep it here."}</p>
            {!query && <button type="button" onClick={() => picker.open()} className="app-press mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#172033] px-6 py-3.5 font-semibold text-white shadow-[0_3px_0_#0b1120]"><Plus className="h-4 w-4" />Open a PDF</button>}
          </div>
        )}
      {actions.sheet}
    </TabScreen>
  );
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export function AccountTab() {
  const [, setLocation] = useLocation();
  const { user, loading, logout } = useAuth();
  const activity = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });
  const { documents } = useLibrary();
  const [version, setVersion] = useState("Web preview");
  const [showPrivacy, setShowPrivacy] = useState(false);
  useEffect(() => { if (isNative()) void CapacitorApp.getInfo().then(info => setVersion(`Version ${info.version} (${info.build})`)).catch(() => undefined); }, []);

  const signOut = async () => { haptic("medium"); await logout(); toast.success("Signed out."); setLocation("/"); };
  const replayIntro = async () => { await setFlag("onboarded", null); setLocation("/welcome"); };

  return (
    <TabScreen title="Account" subtitle={user ? "Signed in" : "Guest mode"}>
      {loading ? <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> : user ? (
        <TiltCard max={6} className="relative overflow-hidden rounded-[28px] bg-[#172033] p-5 text-white shadow-[0_30px_50px_-28px_rgba(23,32,51,.8)]">
          <div className="depth-grid depth-grid-dark" />
          <div className="relative flex items-center gap-4">
            <span className="depth-pop grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[linear-gradient(145deg,#4c84ee,#2457c0)] font-display text-2xl font-semibold shadow-[0_4px_0_#173f94,0_16px_26px_-12px_rgba(50,106,216,.9)]">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
            <div className="min-w-0"><p className="truncate font-display text-xl font-semibold tracking-[-.03em]">{user.name || "Your account"}</p><p className="truncate text-sm text-slate-300">{user.email}</p>{user.role === "admin" && <span className="mt-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#cfe0ff]">ADMIN</span>}</div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4"><Stat value={documents?.length ?? "–"} label="On this device" /><Stat value={activity.data?.length ?? "–"} label="Account saves" /></div>
        </TiltCard>
      ) : (
        <div className="relative overflow-hidden rounded-[28px] bg-[#172033] p-6 text-white">
          <div className="depth-grid depth-grid-dark" />
          <div className="relative"><h2 className="font-display text-2xl font-semibold tracking-[-.04em]">Make Editly yours</h2><p className="mt-2 text-sm leading-6 text-slate-300">Sign in to keep a private record of your document activity. Editing stays available as a guest.</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setLocation("/signup")} className="app-press rounded-2xl bg-white py-3.5 text-sm font-semibold text-[#172033] shadow-[0_3px_0_#c7d4ea]">Create account</button><button type="button" onClick={() => setLocation("/signin")} className="app-press rounded-2xl border border-white/15 bg-white/[.07] py-3.5 text-sm font-semibold"><LogIn className="mr-1.5 inline h-4 w-4" />Log in</button></div>
          </div>
        </div>
      )}

      {user && (
        <section className="mt-6">
          <h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">Account activity</h2>
          <div className="mt-2 rounded-[24px] bg-white px-4 shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
            {activity.isLoading ? <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              : activity.data?.length ? <div className="divide-y divide-slate-100">{activity.data.slice(0, 5).map(item => <div key={item.id} className="flex items-center gap-3 py-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef4ff] text-[#326ad8]"><FileText className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-[15px] font-semibold">{item.name}</p><p className="text-[13px] text-slate-500">{item.pageCount} page{item.pageCount === 1 ? "" : "s"} · {formatBytes(item.byteSize)} · {new Date(item.updatedAt).toLocaleDateString()}</p></div></div>)}</div>
                : <p className="py-6 text-center text-sm text-slate-500">Saves from the editor are listed here.</p>}
          </div>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-[24px] bg-white shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
        {user?.role === "admin" && <SettingRow icon={ShieldCheck} label="Admin console" onClick={() => setLocation("/admin")} />}
        <SettingRow icon={Info} label="How your data is handled" onClick={() => setShowPrivacy(value => !value)} expanded={showPrivacy} />
        {showPrivacy && <p className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-slate-600">PDFs are opened, edited, and exported on this device. Your account stores document names, page counts, sizes, and dates — never the file contents.</p>}
        <SettingRow icon={RotateCcw} label="Replay the intro" onClick={() => void replayIntro()} />
        {user && <SettingRow icon={LogOut} label="Sign out" tone="danger" onClick={() => void signOut()} />}
      </section>

      <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-slate-400"><BrandMark size="sm" /><span>Editly · {version}</span></div>
    </TabScreen>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><p className="font-display text-2xl font-semibold tracking-[-.04em]">{value}</p><p className="text-xs text-slate-300">{label}</p></div>;
}

function SettingRow({ icon: Icon, label, onClick, tone = "default", expanded }: { icon: typeof Info; label: string; onClick: () => void; tone?: "default" | "danger"; expanded?: boolean }) {
  return (
    <button type="button" onClick={() => { haptic("light"); onClick(); }} aria-expanded={expanded} className={`flex w-full items-center gap-3 border-t border-slate-100 px-5 py-4 text-left text-[15px] font-medium first:border-t-0 active:bg-slate-50 ${tone === "danger" ? "text-red-600" : "text-[#172033]"}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone === "danger" ? "bg-red-50" : "bg-slate-100 text-slate-600"}`}><Icon className="h-[18px] w-[18px]" /></span>
      <span className="flex-1">{label}</span>
      {tone !== "danger" && <ChevronRight className={`h-5 w-5 text-slate-300 transition ${expanded ? "rotate-90" : ""}`} />}
    </button>
  );
}
