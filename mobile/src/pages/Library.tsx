import { DocumentStack, TiltCard } from "@/components/Depth";
import { Loader2, MoreHorizontal, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { TabPage } from "../components/TabPage";
import { DocThumb, relativeDate, useDocumentActions, useLibrary, usePdfPicker } from "../lib/documents";
import { haptic } from "../lib/native";

export default function Library() {
  const picker = usePdfPicker();
  const { documents, refresh } = useLibrary();
  const actions = useDocumentActions(refresh);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const visible = useMemo(() => (documents ?? [])
    .filter(document => document.fileName.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "name" ? a.fileName.localeCompare(b.fileName) : b.savedAt - a.savedAt), [documents, query, sort]);

  return (
    <TabPage onRefresh={refresh} title="Library" subtitle={documents ? `${documents.length} document${documents.length === 1 ? "" : "s"} on this device` : "Loading…"}>
      {picker.input}
      <div className="flex gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 shadow-[inset_0_1px_2px_rgba(23,32,51,.05)] focus-within:border-[#326ad8] focus-within:ring-4 focus-within:ring-[#326ad8]/10"><Search className="h-5 w-5 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} type="search" enterKeyHint="search" placeholder="Search documents" aria-label="Search documents" className="app-input" /></label>
        <button type="button" onClick={() => { haptic("light"); setSort(value => value === "recent" ? "name" : "recent"); }} className="app-press h-12 shrink-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">{sort === "recent" ? "Recent" : "A–Z"}</button>
      </div>

      {documents === null ? <div className="grid h-60 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        : visible.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
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
            <div className="mx-auto h-[230px] max-w-[300px]"><DocumentStack compact /></div>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-[-.04em]">{query ? "No matches" : "Your library is empty"}</h2>
            <p className="mx-auto mt-2 max-w-[260px] text-sm leading-6 text-slate-500">{query ? "Try a different name." : "Open a PDF, make your edits, and tap Save to keep it here."}</p>
            {!query && <button type="button" onClick={() => picker.open()} className="app-press mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#172033] px-6 py-3.5 font-semibold text-white shadow-[0_3px_0_#0b1120]"><Plus className="h-4 w-4" />Open a PDF</button>}
          </div>
        )}
    </TabPage>
  );
}
