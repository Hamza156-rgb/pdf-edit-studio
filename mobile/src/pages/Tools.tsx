import { TiltCard } from "@/components/Depth";
import { Combine, Eraser, Highlighter, ImagePlus, LayoutGrid, PenLine, Shapes, ShieldAlert, Signature, Square, Stamp, TextCursorInput, Type } from "lucide-react";
import type { CSSProperties } from "react";
import { TabPage } from "../components/TabPage";
import { usePdfPicker } from "../lib/documents";

const toolGroups = [
  { title: "Edit", items: [
    { label: "Edit text", copy: "Rewrite existing lines", query: "?tool=edittext", icon: TextCursorInput, from: "#4c84ee", to: "#2457c0", edge: "#173f94" },
    { label: "Add text", copy: "Type anywhere", query: "?tool=text", icon: Type, from: "#5b8def", to: "#3166cf", edge: "#1f4aa3" },
    { label: "Whiteout", copy: "Cover content", query: "?tool=whiteout", icon: Square, from: "#94a3b8", to: "#64748b", edge: "#475569" },
    { label: "Redact", copy: "Remove for good", query: "?tool=redact", icon: ShieldAlert, from: "#f07272", to: "#d64545", edge: "#9f2f2f" },
  ] },
  { title: "Annotate", items: [
    { label: "Highlight", copy: "Mark key lines", query: "?tool=highlight", icon: Highlighter, from: "#f2b84b", to: "#d9901a", edge: "#9c6408" },
    { label: "Draw", copy: "Freehand ink", query: "?tool=pen", icon: PenLine, from: "#38bdf8", to: "#0284c7", edge: "#075985" },
    { label: "Shapes", copy: "Boxes & arrows", query: "?tool=rectangle", icon: Shapes, from: "#a78bfa", to: "#7c3aed", edge: "#5b21b6" },
    { label: "Eraser", copy: "Paint it white", query: "?tool=eraser", icon: Eraser, from: "#fb923c", to: "#ea580c", edge: "#9a3412" },
  ] },
  { title: "Insert", items: [
    { label: "Sign", copy: "Type, draw, upload", query: "?tool=signature", icon: Signature, from: "#8a74f0", to: "#5f45d6", edge: "#43309f" },
    { label: "Image", copy: "Logos & photos", query: "?tool=image", icon: ImagePlus, from: "#2dd4bf", to: "#0d9488", edge: "#115e59" },
  ] },
  { title: "Document", items: [
    { label: "Watermark", copy: "Remove marked ones", query: "?action=watermark", icon: Stamp, from: "#34b47f", to: "#1c8a5f", edge: "#126044" },
    { label: "Pages", copy: "Reorder, rotate, delete", query: "?action=pages", icon: LayoutGrid, from: "#3a4b70", to: "#22304d", edge: "#0b1120" },
    { label: "Merge & split", copy: "Combine or extract pages", query: "?action=options", icon: Combine, from: "#f472b6", to: "#db2777", edge: "#9d174d" },
  ] },
];

export default function Tools() {
  const picker = usePdfPicker();
  return (
    <TabPage title="Tools" subtitle="Pick a tool, then choose a PDF">
      {picker.input}
      {toolGroups.map(group => (
        <section key={group.title} className="mt-5 first:mt-1">
          <h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">{group.title}</h2>
          <div className="mt-2.5 grid grid-cols-1 gap-3 min-[350px]:grid-cols-2 md:grid-cols-3">
            {group.items.map(tool => (
              <TiltCard key={tool.label} max={10} glare={false} className="rounded-[20px]">
                <button type="button" onClick={() => picker.open(tool.query)} className="app-press flex min-h-[76px] w-full items-center gap-3 rounded-[20px] border border-white bg-white p-3 text-left shadow-[0_14px_26px_-20px_rgba(23,32,51,.55)]">
                  <span className="depth-icon h-11 w-11 shrink-0" style={{ background: `linear-gradient(145deg, ${tool.from}, ${tool.to})`, "--icon-edge": tool.edge, transform: "none" } as CSSProperties}><tool.icon className="h-5 w-5" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#172033]">{tool.label}</span><span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-[1.3] text-slate-500">{tool.copy}</span></span>
                </button>
              </TiltCard>
            ))}
          </div>
        </section>
      ))}
    </TabPage>
  );
}
