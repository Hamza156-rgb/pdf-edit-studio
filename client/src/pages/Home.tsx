import { Button } from "@/components/ui/button";
import { BrandMark, DocumentStack, TiltCard } from "@/components/Depth";
import { useAuth } from "@/_core/hooks/useAuth";
import { validatePdfFile } from "@/lib/pdf";
import { stagePdfFile } from "@/lib/stagedFile";
import { ArrowRight, Check, Download, Eraser, FilePenLine, FileUp, Highlighter, Layers, LockKeyhole, MonitorSmartphone, MousePointerClick, MoveUpRight, PenTool, RotateCw, ScanLine, ShieldCheck, Sparkles, X } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptFile = (file?: File) => {
    if (!file) return;
    const validation = validatePdfFile(file);
    if (validation) return setError(validation);
    setError(null);
    stagePdfFile(file);
    setLocation("/editor");
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0]);
  const openPicker = () => fileInputRef.current?.click();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfaf8] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-[#fbfaf8]/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 sm:px-5 lg:px-8">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2.5 text-left" aria-label="Editly home">
            <BrandMark />
            <span className="font-display text-[17px] font-semibold tracking-[-0.03em]">Editly</span>
          </button>
          <div className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 p-1 text-sm font-medium text-slate-600 shadow-sm md:flex">
            {[["#tools", "Tools"], ["#how", "How it works"], ["#privacy", "Privacy"], ["#faq", "FAQ"]].map(([href, label]) => <a key={href} href={href} className="rounded-full px-3.5 py-1.5 transition hover:bg-[#f1f5fb] hover:text-[#172033]">{label}</a>)}
          </div>
          <div className="flex items-center gap-2">
            {!loading && (user
              ? <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="hidden rounded-xl text-slate-600 sm:inline-flex">My files</Button>
              : <Button variant="ghost" onClick={() => setLocation("/account?mode=login")} className="hidden rounded-xl text-slate-600 sm:inline-flex">Log in</Button>)}
            <Button onClick={() => user ? setLocation("/dashboard") : setLocation("/account?mode=signup")} className="hidden rounded-xl bg-[#eaf2ff] px-4 text-[#275cbf] shadow-none hover:bg-[#dceaff] md:inline-flex">{user ? "Your account" : "Sign up"}</Button>
            <Button onClick={openPicker} className="depth-btn rounded-xl bg-[#172033] px-4 text-white hover:bg-[#26334d]">Edit a PDF <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </nav>
      </header>
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onChange} />

      <main>
        <section className="relative">
          <div className="depth-aurora" /><div className="depth-grid" />
          <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-4 pb-16 pt-12 sm:px-5 lg:grid-cols-[1fr_1fr] lg:px-8 lg:pb-24 lg:pt-16">
            <div className="relative z-10">
              <div className="depth-rise mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600 shadow-sm"><Sparkles className="h-3.5 w-3.5 text-[#326ad8]" /> Thoughtful PDF editing, in your browser</div>
              <h1 className="depth-rise depth-rise-2 font-display max-w-2xl text-[2.9rem] font-semibold leading-[.96] tracking-[-0.065em] text-[#172033] sm:text-6xl lg:text-[5.2rem]">Edit PDFs.<br /><span className="bg-[linear-gradient(100deg,#326ad8_10%,#6b5ce7_60%,#326ad8_100%)] bg-clip-text text-transparent">Your way.</span></h1>
              <p className="depth-rise depth-rise-3 mt-6 max-w-xl text-lg leading-8 text-slate-600">A focused workspace to annotate, whiteout, sign, organize, and export documents—without turning your desk into a project.</p>

              <div onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} className="depth-rise depth-rise-4 mt-8 max-w-xl">
                <button type="button" onClick={openPicker} className={`group relative flex w-full items-center gap-4 rounded-2xl border bg-white/90 p-3 pr-4 text-left shadow-[0_22px_50px_-28px_rgba(23,32,51,.45)] backdrop-blur transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#326ad8] ${isDragging ? "scale-[1.02] border-[#326ad8] ring-4 ring-[#326ad8]/15" : "border-slate-200 hover:border-[#9dbdf3]"}`}>
                  <span className="depth-icon h-12 w-12 shrink-0 bg-[linear-gradient(145deg,#4c84ee,#2457c0)] transition group-hover:-translate-y-0.5" style={{ transform: "none" }}><FileUp className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-semibold tracking-[-.02em]">{isDragging ? "Release to open your PDF" : "Drop your PDF here"}</span>
                    <span className="block truncate text-sm text-slate-500">or browse your device · PDF up to 50 MB</span>
                  </span>
                  <span className="depth-btn hidden rounded-xl bg-[#172033] px-4 py-2.5 text-sm font-medium text-white sm:inline-flex">Choose a PDF</span>
                </button>
                {error && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><X className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#1f8f64]" />No account required</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#1f8f64]" />Local-first editing</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#1f8f64]" />Export a real PDF</span></div>
              {!user && <button onClick={() => setLocation("/account?mode=signup")} className="mt-5 w-fit text-sm font-semibold text-[#326ad8] underline decoration-[#bcd6ff] underline-offset-4 transition hover:text-[#275cbf]">Sign up to see your saved document activity</button>}
            </div>
            <div className="relative z-0 -mx-4 sm:mx-0"><DocumentStack /></div>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-white/70">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-6 px-4 py-8 text-sm text-slate-500 sm:px-5 md:grid-cols-4 lg:px-8">
            <Stat icon={Layers} value="1 workspace" label="for every edit" />
            <Stat icon={LockKeyhole} value="0 uploads" label="for guest editing" />
            <Stat icon={Download} value="Real export" label="with your changes" />
            <Stat icon={MousePointerClick} value="Built to focus" label="not to overwhelm" />
          </div>
        </section>

        <section id="tools" className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-24 sm:px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div><p className="eyebrow">Purpose-built tools</p><h2 className="section-title mt-4 max-w-xl">Every edit, clear and considered.</h2></div>
            <p className="max-w-sm leading-7 text-slate-600">A calm toolset for the things people actually need to change in a document.</p>
          </div>
          <div className="mt-12 grid auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-6">
            <TiltCard className="overflow-hidden rounded-[26px] border border-slate-200 bg-white p-7 md:col-span-4 md:row-span-2" max={5}>
              <Tone edge="#1f4aa3" from="#4c84ee" to="#2457c0" icon={PenTool} />
              <h3 className="depth-pop mt-6 font-display text-2xl font-semibold tracking-[-.04em]">Annotate with intent</h3>
              <p className="mt-2 max-w-md leading-7 text-slate-600">Add precise text, ink, highlights, shapes, and images directly over the document.</p>
              <AnnotatePreview />
            </TiltCard>
            <TiltCard className="rounded-[26px] border border-slate-200 bg-white p-7 md:col-span-2"><Tone edge="#5b3fc4" from="#8a74f0" to="#5f45d6" icon={FilePenLine} /><h3 className="depth-pop mt-6 font-display text-xl font-semibold tracking-[-.035em]">Sign confidently</h3><p className="mt-2 text-sm leading-6 text-slate-600">Type, draw, or place your own signature image.</p></TiltCard>
            <TiltCard className="rounded-[26px] border border-slate-200 bg-white p-7 md:col-span-2"><Tone edge="#156b4a" from="#34b47f" to="#1c8a5f" icon={ScanLine} /><h3 className="depth-pop mt-6 font-display text-xl font-semibold tracking-[-.035em]">Cover & replace</h3><p className="mt-2 text-sm leading-6 text-slate-600">Whiteout areas and add replacement text. Redactions flatten on export.</p></TiltCard>
            <TiltCard className="overflow-hidden rounded-[26px] border border-[#24314d] bg-[#172033] p-7 text-white md:col-span-3">
              <Tone edge="#0b1120" from="#3a4b70" to="#22304d" icon={MoveUpRight} />
              <h3 className="depth-pop mt-6 font-display text-xl font-semibold tracking-[-.035em]">Organize pages</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">Reorder, rotate, duplicate, delete, merge, or extract pages before you download.</p>
              <div className="mt-6 flex gap-3" aria-hidden>{[0, 1, 2, 3].map(index => <span key={index} className={`h-16 w-12 rounded-md border border-white/10 bg-white/[.07] transition duration-500 ${index === 1 ? "-translate-y-2 rotate-6 border-[#8eb8ff]/60 bg-[#326ad8]/40" : ""}`} />)}</div>
            </TiltCard>
            <TiltCard className="rounded-[26px] border border-slate-200 bg-[linear-gradient(150deg,#f7fbff,#edf4ff)] p-7 md:col-span-3">
              <div className="flex gap-2"><Chip icon={Eraser} label="Eraser" /><Chip icon={Highlighter} label="Highlight" /><Chip icon={RotateCw} label="Rotate" /></div>
              <h3 className="depth-pop mt-6 font-display text-xl font-semibold tracking-[-.035em]">Undo anything</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Full undo and redo across drawing, moving, resizing, and page actions—experiment freely.</p>
            </TiltCard>
          </div>
        </section>

        <section id="how" className="relative scroll-mt-20 overflow-hidden bg-[#111827] px-4 py-24 text-white sm:px-5 lg:px-8">
          <div className="depth-grid depth-grid-dark" />
          <div className="absolute -right-40 top-10 h-[420px] w-[420px] rounded-full bg-[#326ad8]/25 blur-[110px]" />
          <div className="relative mx-auto max-w-[1280px]">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow text-[#8eb8ff]">How it works</p><h2 className="section-title mt-4 max-w-lg text-white">From upload to finished, without the friction.</h2></div><p className="max-w-sm leading-7 text-slate-300">The editor is designed to keep you close to the document—not a maze of menus.</p></div>
            <div className="mt-14 grid gap-5 [perspective:1200px] md:grid-cols-3">
              <Step n="01" icon={FileUp} title="Open your document" copy="Drop a PDF or choose it from your device. We validate it before it opens." />
              <Step n="02" icon={PenTool} title="Make the changes" copy="Use the canvas, page rail, and focused inspector to make every adjustment." />
              <Step n="03" icon={Download} title="Export with confidence" copy="Download a new PDF that includes your annotations, edits, and page changes." />
            </div>
          </div>
        </section>

        <section id="privacy" className="mx-auto grid max-w-[1280px] scroll-mt-20 items-center gap-12 px-4 py-24 sm:px-5 lg:grid-cols-2 lg:px-8">
          <TiltCard className="overflow-hidden rounded-[30px] border border-[#d6e5ff] bg-[linear-gradient(155deg,#f3f8ff,#e4efff)] p-8 sm:p-11" max={4}>
            <div className="flex items-start justify-between">
              <Tone edge="#1f4aa3" from="#4c84ee" to="#2457c0" icon={ShieldCheck} />
              <div className="relative h-24 w-28" aria-hidden>
                {[0, 1, 2].map(index => <span key={index} className="absolute inset-x-0 h-14 rounded-xl border border-white bg-white/70 shadow-[0_14px_24px_-16px_rgba(23,32,51,.5)] backdrop-blur" style={{ top: index * 12, transform: `translateZ(${index * 20}px) scale(${0.86 + index * 0.07})` }} />)}
                <LockKeyhole className="absolute bottom-3 left-1/2 h-5 w-5 -translate-x-1/2 text-[#326ad8]" style={{ transform: "translateZ(60px)" }} />
              </div>
            </div>
            <h2 className="section-title depth-pop mt-7">Your documents deserve discretion.</h2>
            <p className="mt-5 max-w-lg leading-7 text-slate-600">Guest editing is local-first: PDF bytes remain in your browser session and recover only from encrypted browser storage on this device. Your edited file is prepared for download here—not passed through a public link.</p>
            <div className="mt-8 grid gap-3 text-sm font-medium text-slate-700">
              {["Client-side PDF rendering and export", "No public document URLs for guest sessions", "Clear session recovery and cleanup controls"].map(item => <p key={item} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 shadow-sm"><LockKeyhole className="h-4 w-4 text-[#326ad8]" />{item}</p>)}
            </div>
          </TiltCard>
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Designed for trust</p>
            <h2 className="section-title mt-4">Simple security, explained plainly.</h2>
            <p className="mt-5 max-w-xl leading-7 text-slate-600">We don’t make vague promises around sensitive files. The workspace signals where your document is handled, when it can be recovered, and what a permanent redaction means before you apply it.</p>
            <div className="mt-8 grid max-w-md grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><MonitorSmartphone className="h-4 w-4 text-[#326ad8]" /><p className="mt-3 font-semibold">Runs in your browser</p><p className="mt-1 text-slate-500">Nothing to install.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><ShieldCheck className="h-4 w-4 text-[#1f8f64]" /><p className="mt-3 font-semibold">Private by default</p><p className="mt-1 text-slate-500">No sharing links.</p></div>
            </div>
            <Button onClick={openPicker} className="depth-btn mt-8 w-fit rounded-xl bg-[#172033] px-5 text-white hover:bg-[#26334d]">Open a PDF <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-slate-200 bg-white px-4 py-24 sm:px-5 lg:px-8">
          <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.7fr_1.3fr]">
            <div><p className="eyebrow">FAQ</p><h2 className="section-title mt-4">Good questions.</h2></div>
            <div className="space-y-3">
              <Faq q="Can I create an account and sign in?" a="Yes. Use Sign up or Log in to create an account with your email and password. Your account gives you a private dashboard for document activity and preferences; guest editing remains available." />
              <Faq q="Can I use the editor without creating an account?" a="Yes. Guest editing opens a local browser session, so you can edit and export without creating an account." />
              <Faq q="Will my downloaded PDF contain the changes I made?" a="Yes. The export is a newly generated PDF. It includes supported annotations, images, signatures, page changes, and flattened whiteouts or applied redactions." />
              <Faq q="Can I alter every piece of existing PDF text?" a="PDFs do not reliably preserve editable text structures. When direct replacement is unsafe, use Whiteout with a replacement text layer; the export flattens the cover into the resulting PDF." />
              <Faq q="What happens if I refresh the page?" a="If your browser supports local session storage, we offer to restore the active document and editing state after a refresh." />
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-5 lg:px-8">
          <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[32px] bg-[#172033] px-6 py-14 text-white shadow-[0_40px_80px_-40px_rgba(23,32,51,.7)] sm:px-12">
            <div className="depth-grid depth-grid-dark" />
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#326ad8]/40 blur-3xl" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_.8fr]">
              <div>
                <h2 className="font-display text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Your next PDF is one drop away.</h2>
                <p className="mt-4 max-w-lg leading-7 text-slate-300">Open a file, make your changes, and download the result. No account needed to start.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button onClick={openPicker} className="rounded-xl bg-white px-5 text-[#172033] shadow-[0_1px_0_#c7d4ea,0_12px_24px_-12px_rgba(0,0,0,.6)] hover:bg-[#eaf2ff]">Edit a PDF <ArrowRight className="ml-2 h-4 w-4" /></Button>
                  {!user && <Button variant="outline" onClick={() => setLocation("/account?mode=signup")} className="rounded-xl border-white/20 bg-white/[.05] text-white hover:bg-white/10 hover:text-white">Create a free account</Button>}
                </div>
              </div>
              <div className="hidden lg:block"><DocumentStack compact /></div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-[#fbfaf8]"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-8"><div className="flex items-center gap-2 font-medium text-[#172033]"><BrandMark size="sm" /> Editly</div><p>Private, practical PDF editing.</p><div className="flex gap-5"><a href="#privacy" className="hover:text-[#172033]">Privacy</a><a href="#faq" className="hover:text-[#172033]">Help</a></div></div></footer>
    </div>
  );
}

function Tone({ icon: Icon, from, to, edge }: { icon: typeof PenTool; from: string; to: string; edge: string }) {
  return <span className="depth-icon" style={{ background: `linear-gradient(145deg, ${from}, ${to})`, "--icon-edge": edge } as React.CSSProperties}><Icon className="h-5 w-5" /></span>;
}

function Chip({ icon: Icon, label }: { icon: typeof PenTool; label: string }) {
  return <span className="depth-pop inline-flex items-center gap-1.5 rounded-full border border-white bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm"><Icon className="h-3.5 w-3.5 text-[#326ad8]" />{label}</span>;
}

function AnnotatePreview() {
  return (
    <div className="relative mt-8 h-56 [transform-style:preserve-3d]" aria-hidden>
      <div className="absolute inset-x-0 bottom-0 top-4 rounded-t-2xl border border-slate-200 bg-[#f8fafd] p-6 shadow-inner">
        <span className="block h-2 w-40 rounded-full bg-slate-300" />
        <span className="mt-4 block h-1.5 w-full rounded-full bg-slate-200" />
        <span className="relative mt-2.5 block h-1.5 w-[85%] rounded-full bg-slate-200"><span className="absolute -inset-y-1.5 left-[18%] w-[40%] rounded bg-[#ffe27a]/80 mix-blend-multiply" /></span>
        <span className="mt-2.5 block h-1.5 w-[92%] rounded-full bg-slate-200" />
        <span className="mt-2.5 block h-1.5 w-[60%] rounded-full bg-slate-200" />
        <svg viewBox="0 0 200 60" className="absolute bottom-6 left-10 h-14 w-48 text-[#e5484d]"><ellipse cx="100" cy="30" rx="92" ry="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 0" /></svg>
      </div>
      <div className="absolute right-6 top-0 rounded-xl border border-white bg-white px-3 py-2 text-xs font-semibold text-[#326ad8] shadow-[0_18px_30px_-14px_rgba(23,32,51,.45)]" style={{ transform: "translateZ(60px)" }}>Aa Text box</div>
      <div className="absolute bottom-10 right-16 rounded-xl border border-[#ffe7a0] bg-[#fff3c4] px-3 py-2 text-xs font-semibold text-[#8a6100] shadow-[0_18px_30px_-14px_rgba(23,32,51,.45)]" style={{ transform: "translateZ(90px) rotate(-3deg)" }}>Check this clause</div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof PenTool; value: string; label: string }) {
  return <div className="flex items-start gap-3"><span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef4ff] text-[#326ad8] shadow-[inset_0_1px_0_#fff,0_2px_0_#d3e2fb]"><Icon className="h-4 w-4" /></span><div><p className="font-display text-xl font-semibold text-[#172033] sm:text-2xl">{value}</p><p className="mt-0.5">{label}</p></div></div>;
}

function Step({ n, icon: Icon, title, copy }: { n: string; icon: typeof PenTool; title: string; copy: string }) {
  return (
    <TiltCard className="rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] p-7 backdrop-blur" max={7}>
      <div className="flex items-center justify-between">
        <span className="depth-icon h-11 w-11" style={{ background: "linear-gradient(145deg,#4c84ee,#2457c0)", "--icon-edge": "#0f2a66" } as React.CSSProperties}><Icon className="h-5 w-5" /></span>
        <span className="font-display text-5xl font-semibold tracking-[-.06em] text-white/10">{n}</span>
      </div>
      <h3 className="depth-pop mt-8 font-display text-xl font-semibold tracking-[-.03em]">{title}</h3>
      <p className="mt-3 leading-7 text-slate-300">{copy}</p>
    </TiltCard>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return <details className="group rounded-2xl border border-slate-200 bg-[#fbfcfe] px-5 py-4 transition open:bg-white open:shadow-[0_18px_36px_-28px_rgba(23,32,51,.4)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-lg font-semibold tracking-[-.025em] text-[#172033]">{q}<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef4ff] text-[#326ad8] transition group-open:rotate-45">+</span></summary><p className="max-w-2xl pt-3 leading-7 text-slate-600">{a}</p></details>;
}
