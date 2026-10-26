import { BrandMark, DocumentStack, PrivacyVault, ToolOrbit } from "@/components/Depth";
import { haptic, setFlag, setStatusBar } from "@/lib/native";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const slides = [
  { scene: <DocumentStack />, eyebrow: "Welcome to Editly", title: "Edit any PDF, right in your pocket.", copy: "Open a document, rewrite its text, add notes, and export a real PDF — all from your phone." },
  { scene: <ToolOrbit />, eyebrow: "Every tool you need", title: "Sign, highlight, redact, and more.", copy: "Edit existing text, place signatures, remove watermarks, and reorganize pages with a tap." },
  { scene: <PrivacyVault />, eyebrow: "Private by design", title: "Your files stay on your device.", copy: "Documents are processed locally. Your account only keeps names and sizes — never the PDF itself." },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [, setLocation] = useLocation();
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const last = index === slides.length - 1;

  useEffect(() => { setStatusBar("dark"); }, []);

  // Keep the active dot in sync with swipes.
  const onScroll = () => {
    const track = trackRef.current; if (!track) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== index) { setIndex(next); haptic("light"); }
  };
  const goTo = (next: number) => trackRef.current?.scrollTo({ left: next * trackRef.current.clientWidth, behavior: "smooth" });
  const finish = async (path: string) => { haptic("medium"); await setFlag("onboarded", "1"); onDone(); setLocation(path); };

  return (
    <div className="app-screen relative flex h-[100dvh] flex-col overflow-hidden bg-[#0f172a] text-white">
      <div className="depth-grid depth-grid-dark" />
      <div className="pointer-events-none absolute -left-32 top-24 h-[380px] w-[380px] rounded-full bg-[#326ad8]/35 blur-[100px]" />
      <div className="pointer-events-none absolute -right-32 bottom-40 h-[320px] w-[320px] rounded-full bg-[#6b5ce7]/25 blur-[100px]" />

      <header className="app-safe-top relative z-10 flex items-center justify-between px-5 pt-3">
        <span className="flex items-center gap-2 text-sm font-semibold"><BrandMark size="sm" />Editly</span>
        {!last && <button type="button" onClick={() => void finish("/")} className="rounded-full px-3 py-2 text-sm font-medium text-white/70 active:bg-white/10">Skip</button>}
      </header>

      <div ref={trackRef} onScroll={onScroll} className="app-snap-track relative z-10 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden">
        {slides.map((slide, slideIndex) => (
          <section key={slide.title} aria-hidden={slideIndex !== index} className="app-onboarding-slide flex w-full shrink-0 snap-center flex-col px-6">
            <div className="app-onboarding-scene relative min-h-0 flex-1">{slide.scene}</div>
            <div className={`pb-4 transition duration-500 ${slideIndex === index ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8eb8ff]">{slide.eyebrow}</p>
              <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.02] tracking-[-.055em]">{slide.title}</h1>
              <p className="mt-3 text-[15px] leading-6 text-slate-300">{slide.copy}</p>
            </div>
          </section>
        ))}
      </div>

      <footer className="app-safe-bottom relative z-10 px-6 pb-4 pt-2">
        <div className="mb-5 flex gap-1.5" role="tablist" aria-label="Intro progress">
          {slides.map((slide, dot) => <button key={slide.title} type="button" role="tab" aria-selected={dot === index} aria-label={`Slide ${dot + 1}`} onClick={() => goTo(dot)} className={`h-1.5 rounded-full transition-all duration-500 ${dot === index ? "w-8 bg-white" : "w-1.5 bg-white/30"}`} />)}
        </div>
        {last ? (
          <div className="space-y-2.5">
            <button type="button" onClick={() => void finish("/signup")} className="app-press w-full rounded-2xl bg-white py-4 text-[15px] font-semibold text-[#172033] shadow-[0_3px_0_#c7d4ea,0_18px_30px_-14px_rgba(0,0,0,.8)]">Create a free account</button>
            <button type="button" onClick={() => void finish("/signin")} className="app-press w-full rounded-2xl border border-white/15 bg-white/[.07] py-4 text-[15px] font-semibold text-white backdrop-blur">I already have an account</button>
            <button type="button" onClick={() => void finish("/")} className="w-full py-2.5 text-sm font-medium text-white/60">Continue as guest</button>
          </div>
        ) : (
          <button type="button" onClick={() => { haptic("light"); goTo(index + 1); }} className="app-press flex w-full items-center justify-center gap-2 rounded-2xl bg-[#326ad8] py-4 text-[15px] font-semibold text-white shadow-[0_3px_0_#1f4aa3,0_18px_30px_-14px_rgba(50,106,216,.9)]">Continue <ArrowRight className="h-4 w-4" /></button>
        )}
      </footer>
    </div>
  );
}
