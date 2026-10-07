import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { exportEditedPdf, triggerPdfDownload } from "@/lib/pdf";
import { DashboardDensity, loadDashboardDensity, saveDashboardDensity, toggleDashboardDensity } from "@/lib/dashboardDensity";
import { deleteLibraryDocument, LibraryDocumentSummary, listLibraryDocuments, loadLibraryDocument, renameLibraryDocument } from "@/lib/session";
import { stageEditorSession } from "@/lib/stagedFile";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, Clock3, Download, FileClock, FilePenLine, FileText, FolderOpen, LayoutDashboard, LayoutList, LogOut, Pencil, Plus, Rows3, Search, Settings, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SortMode = "recent" | "name" | "size";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, loading, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [density, setDensity] = useState<DashboardDensity>(() => loadDashboardDensity(window.localStorage));
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LibraryDocumentSummary[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const accountDocuments = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });

  const refreshLibrary = async () => {
    setLibraryLoading(true);
    try { setDocuments(await listLibraryDocuments()); }
    catch { toast.error("This browser could not access the local library."); }
    finally { setLibraryLoading(false); }
  };

  useEffect(() => { void refreshLibrary(); }, []);
  useEffect(() => { saveDashboardDensity(window.localStorage, density); }, [density]);
  useEffect(() => {
    const handleDensityShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDensity(current => toggleDashboardDensity(current));
      }
    };
    window.addEventListener("keydown", handleDensityShortcut);
    return () => window.removeEventListener("keydown", handleDensityShortcut);
  }, []);

  const filtered = useMemo(() => [...documents]
    .filter(document => document.fileName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "name" ? a.fileName.localeCompare(b.fileName) : sort === "size" ? documentSize(b) - documentSize(a) : b.savedAt - a.savedAt), [documents, search, sort]);

  const openDocument = async (id: string) => {
    const document = await loadLibraryDocument(id);
    if (!document) return toast.error("That local document is no longer available.");
    stageEditorSession(document);
    setLocation("/editor");
  };

  const downloadDocument = async (id: string) => {
    const document = await loadLibraryDocument(id);
    if (!document) return toast.error("That local document is no longer available.");
    try {
      const bytes = await exportEditedPdf(document);
      triggerPdfDownload(bytes, `${document.fileName || "edited-document"}.pdf`);
    } catch { toast.error("We could not export that local document."); }
  };

  const commitRename = async () => {
    if (!rename?.name.trim()) return;
    await renameLibraryDocument(rename.id, rename.name.trim());
    setRename(null);
    await refreshLibrary();
    toast.success("Document renamed.");
  };

  const commitDelete = async () => {
    if (!confirmDelete) return;
    await deleteLibraryDocument(confirmDelete);
    setConfirmDelete(null);
    await refreshLibrary();
    toast.success("Document removed from this device.");
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f5f7fb]"><FilePenLine className="h-6 w-6 animate-pulse text-[#326ad8]" /></div>;
  if (!user) return <AccountGate onBack={() => setLocation("/")} onSignIn={() => setLocation("/account?mode=login")} onSignUp={() => setLocation("/account?mode=signup")} />;

  const recent = filtered[0];
  const firstName = user.name?.split(" ")[0] || "there";
  const accountCount = accountDocuments.data?.length ?? 0;

  return <div data-dashboard-density={density} className="min-h-screen bg-[#f5f7fb] text-[#162033]">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex h-[74px] w-full items-center justify-between">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 text-left"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#172033] text-white shadow-[0_8px_18px_rgba(23,32,51,.2)]"><FilePenLine className="h-5 w-5" /></span><span><span className="block font-display text-lg font-semibold tracking-[-.04em]">Editly</span><span className="hidden text-[11px] font-medium text-slate-400 sm:block">Document workspace</span></span></button>
        <div className="flex items-center gap-1.5 sm:gap-2"><span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-[#fbfcfe] px-3 py-1.5 text-xs font-semibold text-slate-500 md:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#1f8f64]" />Workspace secure</span><div className="dashboard-density-control hidden items-center rounded-xl border border-slate-200 bg-[#fbfcfe] p-1 sm:flex" role="group" aria-label="Dashboard density"><button type="button" onClick={() => setDensity("comfortable")} aria-pressed={density === "comfortable"} title="Comfortable view" className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${density === "comfortable" ? "bg-white text-[#326ad8] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><LayoutList className="h-3.5 w-3.5" />Comfortable</button><button type="button" onClick={() => setDensity("compact")} aria-pressed={density === "compact"} title="Compact view" className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${density === "compact" ? "bg-white text-[#326ad8] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Rows3 className="h-3.5 w-3.5" />Compact</button></div><Button variant="ghost" size="sm" onClick={() => setLocation("/profile")} className="rounded-xl text-slate-600"><Settings className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Account</span></Button><Button variant="ghost" size="sm" onClick={() => void logout()} className="rounded-xl text-slate-600"><LogOut className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Sign out</span></Button><div className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-[#eaf2ff] text-xs font-bold text-[#326ad8] ring-4 ring-[#f3f7ff]">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</div></div>
      </div>
    </header>

    <main className="dashboard-main w-full px-4 py-7 sm:px-6 sm:py-10 lg:px-8 xl:px-10 2xl:px-12">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative overflow-hidden rounded-[28px] bg-[#172033] px-6 py-7 text-white shadow-[0_24px_55px_-30px_rgba(23,32,51,.65)] sm:px-8 sm:py-9">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#326ad8]/35 blur-3xl" /><div className="absolute -bottom-32 left-[35%] h-64 w-64 rounded-full bg-[#7ea8ff]/15 blur-3xl" />
          <div className="relative"><div className="flex flex-wrap items-center justify-between gap-4"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#d8e7ff]"><Sparkles className="h-3.5 w-3.5" />YOUR PRIVATE WORKSPACE</span><span className="inline-flex items-center gap-2 text-xs font-medium text-slate-300"><CheckCircle2 className="h-4 w-4 text-[#72d5a2]" />Synced account activity</span></div><h1 className="mt-7 max-w-xl font-display text-4xl font-semibold tracking-[-.065em] sm:text-5xl">Good to see you, {firstName}.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Manage your PDFs with a focused space for current work, private document activity, and quick next steps.</p><div className="mt-7 flex flex-wrap gap-3"><Button onClick={() => setLocation("/editor")} className="rounded-xl bg-white px-4 text-[#172033] shadow-none hover:bg-[#eaf2ff]"><Upload className="mr-2 h-4 w-4" />Upload a PDF</Button>{recent && <Button variant="outline" onClick={() => void openDocument(recent.id)} className="rounded-xl border-white/20 bg-white/[.05] text-white hover:bg-white/10 hover:text-white"><ArrowUpRight className="mr-2 h-4 w-4" />Continue editing</Button>}</div></div>
        </div>
        <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_36px_-30px_rgba(23,32,51,.4)]"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf2ff] text-[#326ad8]"><LayoutDashboard className="h-5 w-5" /></span><span className="rounded-full bg-[#ecf8f1] px-2.5 py-1 text-[11px] font-bold text-[#197a55]">PRIVATE</span></div><p className="mt-6 text-sm font-semibold text-slate-500">Workspace status</p><p className="mt-1 font-display text-2xl font-semibold tracking-[-.05em]">All set.</p><p className="mt-2 text-sm leading-6 text-slate-500">Your local documents and private activity are ready when you are.</p><div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5"><StatusNumber label="On this device" value={String(documents.length)} /><StatusNumber label="Account saves" value={String(accountCount)} /></div></aside>
      </section>

      <section className="dashboard-metrics mt-6 grid gap-4 md:grid-cols-3"><PremiumMetric icon={FolderOpen} label="Local documents" value={String(documents.length)} note="available on this device" tone="blue" /><PremiumMetric icon={FileClock} label="Saved activity" value={String(accountCount)} note="private account entries" tone="violet" /><PremiumMetric icon={ShieldCheck} label="Privacy mode" value="Protected" note="no public PDF links" tone="green" /></section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section id="document-library" className="dashboard-library overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_38px_-32px_rgba(23,32,51,.32)]">
          <div className="flex flex-col gap-5 border-b border-slate-100 px-5 py-5 sm:px-6 md:flex-row md:items-center md:justify-between"><div><p className="eyebrow">Document library</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em]">Your documents</h2><p className="mt-1 text-sm text-slate-500">Open, export, or organize locally saved work.</p></div><div className="flex flex-wrap gap-2"><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-[#fbfcfe] px-3 text-sm text-slate-500 focus-within:border-[#326ad8] focus-within:ring-2 focus-within:ring-[#326ad8]/10"><Search className="h-4 w-4" /><input aria-label="Search documents" placeholder="Search library" value={search} onChange={event => setSearch(event.target.value)} className="w-28 bg-transparent outline-none sm:w-36" /></label><select aria-label="Sort documents" value={sort} onChange={event => setSort(event.target.value as SortMode)} className="h-10 rounded-xl border border-slate-200 bg-[#fbfcfe] px-3 text-sm font-medium text-slate-600 outline-none"><option value="recent">Recent</option><option value="name">Name</option><option value="size">File size</option></select></div></div>
          {libraryLoading ? <div className="grid min-h-64 place-items-center text-sm text-slate-500">Loading your private library…</div> : filtered.length ? <div className="divide-y divide-slate-100">{filtered.map((document, index) => <DocumentRow key={document.id} document={document} featured={index === 0} onOpen={() => void openDocument(document.id)} onDownload={() => void downloadDocument(document.id)} onRename={() => setRename({ id: document.id, name: document.fileName })} onDelete={() => setConfirmDelete(document.id)} />)}</div> : <EmptyLibrary onOpen={() => setLocation("/editor")} />}
        </section>

        <aside className="space-y-6"><section className="overflow-hidden rounded-[26px] border border-[#d8e7ff] bg-[linear-gradient(150deg,#f7fbff_0%,#edf5ff_100%)] p-5 shadow-[0_18px_38px_-32px_rgba(23,32,51,.28)]"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Account activity</p><h2 className="mt-2 font-display text-xl font-semibold tracking-[-.045em]">Recent saves</h2></div><button onClick={() => accountDocuments.refetch()} disabled={accountDocuments.isFetching} aria-label="Refresh account activity" className="rounded-lg border border-[#c7dcff] bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-[#326ad8] transition hover:bg-white disabled:opacity-60">{accountDocuments.isFetching ? "Syncing" : "Refresh"}</button></div><p className="mt-3 text-sm leading-6 text-slate-600">Names, sizes, and timestamps are stored privately in your account.</p><div className="mt-5 space-y-3">{accountDocuments.data?.length ? accountDocuments.data.slice(0, 4).map((document, index) => <div key={document.id} className="rounded-2xl border border-white bg-white/80 p-3.5 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-[#dceaff] text-[#326ad8]" : "bg-slate-100 text-slate-500"}`}><FileText className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{document.name}</p><p className="mt-1 text-xs text-slate-500">{document.pageCount} pages · {formatBytes(document.byteSize)}</p><p className="mt-1 text-xs text-slate-400">Saved {new Date(document.updatedAt).toLocaleDateString()}</p></div></div></div>) : <div className="rounded-2xl border border-dashed border-[#c7dcff] bg-white/55 p-4 text-sm leading-6 text-slate-500">Your signed-in saves will be listed here.</div>}</div></section>
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_-32px_rgba(23,32,51,.28)]"><p className="eyebrow">Quick actions</p><div className="mt-4 space-y-2"><QuickAction icon={Upload} label="Upload a new PDF" onClick={() => setLocation("/editor")} /><QuickAction icon={Settings} label="Review account settings" onClick={() => setLocation("/profile")} /><QuickAction icon={FileText} label="View your document library" onClick={() => document.getElementById("document-library")?.scrollIntoView({ behavior: "smooth" })} /></div></section>
        </aside>
      </section>
    </main>
    {rename && <Dialog title="Rename document" onClose={() => setRename(null)}><input autoFocus value={rename.name} onChange={event => setRename({ ...rename, name: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#326ad8] focus:ring-2 focus:ring-[#326ad8]/10" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setRename(null)}>Cancel</Button><Button onClick={() => void commitRename()} className="bg-[#172033] text-white hover:bg-[#26334d]">Save name</Button></div></Dialog>}
    {confirmDelete && <Dialog title="Remove this document?" onClose={() => setConfirmDelete(null)}><p className="text-sm leading-6 text-slate-600">This removes the private saved document from this device’s library.</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button onClick={() => void commitDelete()} className="bg-red-600 text-white hover:bg-red-700">Remove</Button></div></Dialog>}
  </div>;
}

function PremiumMetric({ icon: Icon, label, value, note, tone }: { icon: typeof FileText; label: string; value: string; note: string; tone: "blue" | "violet" | "green" }) {
  const color = tone === "green" ? "bg-[#ecf8f1] text-[#197a55]" : tone === "violet" ? "bg-[#f2edff] text-[#7357d8]" : "bg-[#eaf2ff] text-[#326ad8]";
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_28px_-26px_rgba(23,32,51,.45)]"><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></span><div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 font-display text-2xl font-semibold tracking-[-.045em]">{value}</p></div><p className="max-w-28 text-right text-xs leading-5 text-slate-400">{note}</p></div></div>;
}

function StatusNumber({ label, value }: { label: string; value: string }) { return <div><p className="font-display text-xl font-semibold tracking-[-.04em]">{value}</p><p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">{label}</p></div>; }

function DocumentRow({ document, featured, onOpen, onDownload, onRename, onDelete }: { document: LibraryDocumentSummary; featured: boolean; onOpen: () => void; onDownload: () => void; onRename: () => void; onDelete: () => void }) { return <div className="dashboard-document-row group flex flex-col gap-4 px-5 py-4 transition hover:bg-[#fbfcfe] sm:flex-row sm:items-center sm:px-6"><span className={`dashboard-document-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${featured ? "bg-[#eaf2ff] text-[#326ad8]" : "bg-slate-100 text-slate-500"}`}><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold text-[#172033]">{document.fileName}</p>{featured && <span className="rounded-full bg-[#eef5ff] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#326ad8]">MOST RECENT</span>}</div><p className="dashboard-document-meta mt-1.5 text-sm text-slate-500">{document.pages.length} page{document.pages.length === 1 ? "" : "s"} · {formatBytes(documentSize(document))} · Saved {new Date(document.savedAt).toLocaleDateString()}</p></div><div className="dashboard-document-actions flex items-center gap-1.5"><Button size="sm" onClick={onOpen} className="rounded-lg bg-[#172033] text-white hover:bg-[#26334d]"><ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />Open</Button><Button size="icon" variant="ghost" onClick={onDownload} title="Download" className="rounded-lg"><Download className="h-4 w-4" /></Button><button onClick={onRename} aria-label="Rename document" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#172033]"><Pencil className="h-4 w-4" /></button><button onClick={onDelete} aria-label="Delete document" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>; }

function EmptyLibrary({ onOpen }: { onOpen: () => void }) { return <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf3fc] text-[#326ad8]"><FolderOpen className="h-6 w-6" /></span><h3 className="mt-5 font-display text-xl font-semibold tracking-[-.035em]">Your library is ready.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Open a PDF, make your edits, and save it to keep a private browser-local copy here.</p><Button onClick={onOpen} className="mt-5 rounded-xl bg-[#172033] text-white hover:bg-[#26334d]"><Plus className="mr-1.5 h-4 w-4" />Open the editor</Button></div></div>; }

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Upload; label: string; onClick: () => void }) { return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:border-slate-200 hover:bg-[#fbfcfe] hover:text-[#172033]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1">{label}</span><ChevronRight className="h-4 w-4 text-slate-400" /></button>; }

function AccountGate({ onBack, onSignIn, onSignUp }: { onBack: () => void; onSignIn: () => void; onSignUp: () => void }) { return <div className="grid min-h-screen place-items-center bg-[#f5f7fb] p-5"><div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#172033] text-white"><FilePenLine className="h-6 w-6" /></span><p className="eyebrow mt-7">Private workspace</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-.055em]">Keep your document list close.</h1><p className="mt-4 leading-7 text-slate-600">Create an account to access private document metadata, account preferences, and your workspace. You can still edit any PDF as a guest.</p><Button onClick={onSignUp} className="mt-7 w-full bg-[#172033] text-white hover:bg-[#26334d]">Create account</Button><Button variant="outline" onClick={onSignIn} className="mt-2 w-full">Log in</Button><Button variant="ghost" onClick={onBack} className="mt-2 w-full text-slate-500">Continue as guest</Button></div></div>; }

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-[#172033]/40 p-5"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold tracking-[-.04em]">{title}</h2><button onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-[#172033]">×</button></div><div className="mt-4">{children}</div></div></div>; }

function documentSize(document: LibraryDocumentSummary) { return document.sources.reduce((total, source) => total + source.bytes.byteLength, 0); }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
