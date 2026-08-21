import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { validatePdfFile } from "@/lib/pdf";
import { stagePdfFile } from "@/lib/stagedFile";
import { ArrowRight, Check, FilePenLine, FileUp, LockKeyhole, Menu, MoveUpRight, PenTool, ScanLine, ShieldCheck, Sparkles, X } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfaf8] text-[#172033]">
      <nav className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 lg:px-8">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2.5 text-left" aria-label="PDF Edit Studio home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#172033] text-white shadow-sm"><FilePenLine className="h-5 w-5" /></span>
          <span className="font-display text-[17px] font-semibold tracking-[-0.03em]">Editly</span>
        </button>
        <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#tools" className="transition hover:text-[#172033]">Tools</a><a href="#how" className="transition hover:text-[#172033]">How it works</a><a href="#privacy" className="transition hover:text-[#172033]">Privacy</a><a href="#faq" className="transition hover:text-[#172033]">FAQ</a>
        </div>
        <div className="flex items-center gap-2">{!loading && (user ? <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="hidden rounded-xl text-slate-600 sm:inline-flex">My files</Button> : <Button variant="ghost" onClick={() => setLocation("/account?mode=login")} className="hidden rounded-xl text-slate-600 sm:inline-flex">Log in</Button>)}<Button onClick={() => user ? setLocation("/dashboard") : setLocation("/account?mode=signup")} className="hidden rounded-xl bg-[#eaf2ff] px-4 text-[#275cbf] shadow-none hover:bg-[#dceaff] md:inline-flex">{user ? "Your account" : "Sign up"}</Button><Button onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-[#172033] px-4 text-white shadow-none hover:bg-[#26334d]">Edit a PDF <ArrowRight className="ml-1 h-4 w-4" /></Button></div>
      </nav>
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onChange} />

      <main>
        <section className="relative mx-auto grid max-w-[1280px] gap-12 px-5 pb-20 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-28 lg:pt-20">
          <div className="absolute left-[-12%] top-[-8%] -z-0 h-[430px] w-[430px] rounded-full bg-[#dae9ff] opacity-60 blur-[100px]" />
          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600 shadow-sm"><Sparkles className="h-3.5 w-3.5 text-[#326ad8]" /> Thoughtful PDF editing, in your browser</div>
            <h1 className="font-display max-w-2xl text-5xl font-semibold leading-[.98] tracking-[-0.065em] text-[#172033] sm:text-6xl lg:text-7xl">Edit PDFs.<br /><span className="text-[#326ad8]">Your way.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">A focused workspace to annotate, whiteout, sign, organize, and export documents—without turning your desk into a project.</p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#1f8f64]" />No account required</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#1f8f64]" />Local-first editing</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#1f8f64]" />Export a real PDF</span></div>{!user && <button onClick={() => setLocation("/account?mode=signup")} className="mt-6 w-fit text-sm font-semibold text-[#326ad8] underline decoration-[#bcd6ff] underline-offset-4 transition hover:text-[#275cbf]">Sign up to see your saved document activity</button>}
          </div>
          <div className="relative z-10">
            <div onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} className={`relative overflow-hidden rounded-[28px] border bg-white p-4 shadow-[0_30px_80px_-30px_rgba(23,32,51,.28)] transition ${isDragging ? "border-[#326ad8] ring-4 ring-[#326ad8]/10" : "border-slate-200"}`}>
              <div className="rounded-[20px] bg-[#f2f6fc] p-6 sm:p-9">
                <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.17em] text-slate-500">Start editing</span><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1f8f64] shadow-sm">Private session</span></div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="group mt-7 flex min-h-[262px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center transition hover:border-[#326ad8] hover:bg-[#fbfdff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#326ad8]">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e9f1ff] text-[#326ad8] transition group-hover:-translate-y-1"><FileUp className="h-7 w-7" /></span>
                  <span className="mt-5 font-display text-xl font-semibold tracking-[-.035em]">Drop your PDF here</span>
                  <span className="mt-2 text-sm text-slate-500">or browse files from your device</span>
                  <span className="mt-5 rounded-xl bg-[#172033] px-4 py-2.5 text-sm font-medium text-white">Choose a PDF</span>
                </button>
                <p className="mt-5 text-center text-xs leading-5 text-slate-500">PDF only · Up to 50 MB for a local guest session<br />Your document stays in this browser unless you choose to save it.</p>
              </div>
            </div>
            {error && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><X className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white/70"><div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 px-5 py-9 text-sm text-slate-500 md:grid-cols-4 lg:px-8"><div><p className="font-display text-2xl font-semibold text-[#172033]">1 workspace</p><p className="mt-1">for every edit</p></div><div><p className="font-display text-2xl font-semibold text-[#172033]">0 uploads</p><p className="mt-1">for guest editing</p></div><div><p className="font-display text-2xl font-semibold text-[#172033]">Real export</p><p className="mt-1">with your changes</p></div><div><p className="font-display text-2xl font-semibold text-[#172033]">Built to focus</p><p className="mt-1">not to overwhelm</p></div></div></section>

        <section id="tools" className="mx-auto max-w-[1280px] px-5 py-24 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><p className="eyebrow">Purpose-built tools</p><h2 className="section-title mt-4">Every edit, clear and considered.</h2><p className="mt-5 max-w-sm leading-7 text-slate-600">A calm toolset for the things people actually need to change in a document.</p></div><div className="grid gap-4 sm:grid-cols-2"><Feature icon={PenTool} title="Annotate with intent" copy="Add precise text, ink, highlights, shapes, and images directly over the document." /><Feature icon={ScanLine} title="Cover & replace" copy="Whiteout areas and add replacement text. Applied redactions are flattened on export." /><Feature icon={FilePenLine} title="Sign confidently" copy="Add a typed signature, draw into the document, or place your own signature image." /><Feature icon={MoveUpRight} title="Organize pages" copy="Reorder, rotate, duplicate, delete, merge, or extract pages before you download." /></div></div></section>

        <section id="how" className="bg-[#172033] px-5 py-24 text-white lg:px-8"><div className="mx-auto max-w-[1280px]"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow text-[#8eb8ff]">How it works</p><h2 className="section-title mt-4 max-w-lg text-white">From upload to finished, without the friction.</h2></div><p className="max-w-sm leading-7 text-slate-300">The editor is designed to keep you close to the document—not a maze of menus.</p></div><div className="mt-14 grid gap-5 md:grid-cols-3"><Step n="01" title="Open your document" copy="Drop a PDF or choose it from your device. We validate it before it opens." /><Step n="02" title="Make the changes" copy="Use the canvas, page rail, and focused inspector to make every adjustment." /><Step n="03" title="Export with confidence" copy="Download a new PDF that includes your annotations, edits, and page changes." /></div></div></section>

        <section id="privacy" className="mx-auto grid max-w-[1280px] gap-12 px-5 py-24 lg:grid-cols-2 lg:px-8"><div className="rounded-[28px] bg-[#eaf3ff] p-8 sm:p-11"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#326ad8] shadow-sm"><ShieldCheck /></div><h2 className="section-title mt-7">Your documents deserve discretion.</h2><p className="mt-5 max-w-lg leading-7 text-slate-600">Guest editing is local-first: PDF bytes remain in your browser session and recover only from encrypted browser storage on this device. Your edited file is prepared for download here—not passed through a public link.</p><div className="mt-8 grid gap-3 text-sm font-medium text-slate-700"><p className="flex items-center gap-3"><LockKeyhole className="h-4 w-4 text-[#326ad8]" />Client-side PDF rendering and export</p><p className="flex items-center gap-3"><LockKeyhole className="h-4 w-4 text-[#326ad8]" />No public document URLs for guest sessions</p><p className="flex items-center gap-3"><LockKeyhole className="h-4 w-4 text-[#326ad8]" />Clear session recovery and cleanup controls</p></div></div><div className="flex flex-col justify-center"><p className="eyebrow">Designed for trust</p><h2 className="section-title mt-4">Simple security, explained plainly.</h2><p className="mt-5 max-w-xl leading-7 text-slate-600">We don’t make vague promises around sensitive files. The workspace signals where your document is handled, when it can be recovered, and what a permanent redaction means before you apply it.</p><Button onClick={() => fileInputRef.current?.click()} className="mt-8 w-fit rounded-xl bg-[#172033] px-5 text-white hover:bg-[#26334d]">Open a PDF <ArrowRight className="ml-2 h-4 w-4" /></Button></div></section>

        <section id="faq" className="border-t border-slate-200 bg-white px-5 py-24 lg:px-8"><div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><p className="eyebrow">FAQ</p><h2 className="section-title mt-4">Good questions.</h2></div><div className="divide-y divide-slate-200"><Faq q="Can I create an account and sign in?" a="Yes. Use Create account or Sign in to continue through the secure account portal. Your account gives you a private dashboard for document activity and preferences; guest editing remains available." /><Faq q="Can I use the editor without creating an account?" a="Yes. Guest editing opens a local browser session, so you can edit and export without creating an account." /><Faq q="Will my downloaded PDF contain the changes I made?" a="Yes. The export is a newly generated PDF. It includes supported annotations, images, signatures, page changes, and flattened whiteouts or applied redactions." /><Faq q="Can I alter every piece of existing PDF text?" a="PDFs do not reliably preserve editable text structures. When direct replacement is unsafe, use Whiteout with a replacement text layer; the export flattens the cover into the resulting PDF." /><Faq q="What happens if I refresh the page?" a="If your browser supports local session storage, we offer to restore the active document and editing state after a refresh." /></div></div></section>
      </main>
      <footer className="border-t border-slate-200 bg-[#fbfaf8]"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex items-center gap-2 font-medium text-[#172033]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#172033] text-white"><FilePenLine className="h-4 w-4" /></span> Editly</div><p>Private, practical PDF editing.</p><div className="flex gap-5"><a href="#privacy" className="hover:text-[#172033]">Privacy</a><a href="#faq" className="hover:text-[#172033]">Help</a></div></div></footer>
    </div>
  );
}

function Feature({ icon: Icon, title, copy }: { icon: typeof PenTool; title: string; copy: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"><Icon className="h-5 w-5 text-[#326ad8]" /><h3 className="mt-5 font-display text-lg font-semibold tracking-[-.03em]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></div>; }
function Step({ n, title, copy }: { n: string; title: string; copy: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-7"><span className="text-sm font-semibold text-[#8eb8ff]">{n}</span><h3 className="mt-8 font-display text-xl font-semibold tracking-[-.03em]">{title}</h3><p className="mt-3 leading-7 text-slate-300">{copy}</p></div>; }
function Faq({ q, a }: { q: string; a: string }) { return <details className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-lg font-semibold tracking-[-.025em] text-[#172033]">{q}<span className="text-[#326ad8] transition group-open:rotate-45">+</span></summary><p className="max-w-2xl pt-3 leading-7 text-slate-600">{a}</p></details>; }
