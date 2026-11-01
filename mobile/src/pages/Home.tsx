import { useAuth } from "../lib/auth";
import { DocumentStack, TiltCard } from "@/components/Depth";
import { useIonRouter } from "@ionic/react";
import { ChevronRight, CloudOff, FileText, Highlighter, LayoutGrid, Loader2, ShieldAlert, Signature, Sparkles, Stamp, TextCursorInput } from "lucide-react";
import type { CSSProperties } from "react";
import { TabPage } from "../components/TabPage";
import { DocumentRow, useDocumentActions, useLibrary, usePdfPicker } from "../lib/documents";

const quickTools = [
  { label: "Edit text", query: "?tool=edittext", icon: TextCursorInput, from: "#4c84ee", to: "#2457c0", edge: "#173f94" },
  { label: "Sign", query: "?tool=signature", icon: Signature, from: "#8a74f0", to: "#5f45d6", edge: "#43309f" },
  { label: "Highlight", query: "?tool=highlight", icon: Highlighter, from: "#f2b84b", to: "#d9901a", edge: "#9c6408" },
  { label: "Redact", query: "?tool=redact", icon: ShieldAlert, from: "#f07272", to: "#d64545", edge: "#9f2f2f" },
  { label: "Watermark", query: "?action=watermark", icon: Stamp, from: "#34b47f", to: "#1c8a5f", edge: "#126044" },
  { label: "Pages", query: "?action=pages", icon: LayoutGrid, from: "#3a4b70", to: "#22304d", edge: "#0b1120" },
];

export default function Home() {
  const router = useIonRouter();
  const { user, refresh: refreshUser } = useAuth();
  const picker = usePdfPicker();
  const { documents, refresh } = useLibrary();
  const actions = useDocumentActions(refresh);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0];

  return (
    <TabPage title={firstName ? `Hi, ${firstName}` : "Welcome"} subtitle={greeting} onRefresh={() => Promise.all([refresh(), refreshUser()])}>
      {picker.input}
      <TiltCard max={7} className="relative mt-2 overflow-hidden rounded-[28px] bg-[#172033] p-6 text-white shadow-[0_30px_50px_-28px_rgba(23,32,51,.8)]">
        <div className="depth-grid depth-grid-dark" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#326ad8]/45 blur-3xl" />
        <div className="app-hero-scene pointer-events-none absolute -right-10 top-1 w-[190px] max-[359px]:hidden"><DocumentStack compact /></div>
        <div className="relative max-w-[58%] max-[359px]:max-w-full">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#cfe0ff]"><Sparkles className="h-3 w-3" />Private editor</span>
          <h2 className="depth-pop mt-4 font-display text-[1.55rem] font-semibold leading-[1.1] tracking-[-.045em]">Open a PDF and start editing.</h2>
        </div>
        <button type="button" onClick={() => picker.open()} className="app-press depth-pop relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-[#172033] shadow-[0_3px_0_#c7d4ea,0_16px_26px_-14px_rgba(0,0,0,.7)]"><FileText className="h-4 w-4" />Choose a PDF</button>
      </TiltCard>

      {!user && (
        <button type="button" onClick={() => router.push("/signup")} className="app-press mt-4 flex w-full items-center gap-3 rounded-2xl border border-[#d6e5ff] bg-[linear-gradient(150deg,#f7fbff,#eaf2ff)] p-4 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#326ad8] text-white shadow-[0_3px_0_#1f4aa3]"><CloudOff className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">You're using Editly as a guest</span><span className="block text-[13px] text-slate-500">Create a free account to keep document activity.</span></span>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>
      )}

      <section className="mt-7">
        <h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">Quick tools</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-6">
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
        <div className="flex items-center justify-between"><h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">Recent</h2>{documents && documents.length > 3 && <button type="button" onClick={() => router.push("/tabs/library", "none")} className="text-sm font-semibold text-[#326ad8]">See all</button>}</div>
        <div className="mt-2 rounded-[24px] bg-white px-4 shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
          {documents === null ? <div className="grid h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            : documents.length ? <div className="divide-y divide-slate-100">{documents.slice(0, 3).map(document => <DocumentRow key={document.id} document={document} onOpen={() => void actions.openDocument(document.id)} onMore={() => actions.showActions(document)} />)}</div>
              : <p className="py-8 text-center text-sm leading-6 text-slate-500">Documents you save from the editor<br />will appear here.</p>}
        </div>
      </section>
    </TabPage>
  );
}
