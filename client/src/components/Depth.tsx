import { FilePenLine } from "lucide-react";
import { CSSProperties, HTMLAttributes, PointerEvent, ReactNode, useCallback, useRef } from "react";

/**
 * Lightweight CSS-3D primitives. Everything is driven by CSS custom properties so
 * pointer movement never re-renders React, and all motion is disabled for touch
 * devices and users who prefer reduced motion (see the `.depth-*` rules in index.css).
 */

function canTilt() {
  return typeof window !== "undefined"
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Writes normalized pointer position (-0.5..0.5) into --px/--py on the element. */
export function usePointerDepth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef(0);
  const onPointerMove = useCallback((event: PointerEvent<T>) => {
    const el = ref.current;
    if (!el || !canTilt()) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
      el.dataset.active = "true";
    });
  }, []);
  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
    delete el.dataset.active;
  }, []);
  return { ref, onPointerMove, onPointerLeave };
}

type TiltCardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode; max?: number; glare?: boolean };

/** A card that tilts toward the pointer with a soft specular glare. */
export function TiltCard({ children, className = "", max = 8, glare = true, style, ...rest }: TiltCardProps) {
  const { ref, onPointerMove, onPointerLeave } = usePointerDepth<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`depth-tilt ${className}`}
      style={{ "--tilt-max": `${max}deg`, ...style } as CSSProperties}
      {...rest}
    >
      {children}
      {glare && <span aria-hidden className="depth-glare" />}
    </div>
  );
}

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return <span className={`brand-mark grid ${box} place-items-center text-white`}><FilePenLine className={icon} /></span>;
}

/**
 * The hero scene: a stack of PDF pages floating in perspective, with editing layers
 * (highlight, signature, sticky note, toolbar) hovering at different depths.
 */
export function DocumentStack({ compact = false }: { compact?: boolean }) {
  const { ref, onPointerMove, onPointerLeave } = usePointerDepth<HTMLDivElement>();
  return (
    <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className={`depth-scene ${compact ? "depth-scene-compact" : ""}`} aria-hidden>
      <div className="depth-stage">
        <div className="depth-page depth-page-back" />
        <div className="depth-page depth-page-mid" />
        <div className="depth-page depth-page-front">
          <div className="flex items-center justify-between">
            <span className="h-2.5 w-24 rounded-full bg-[#172033]" />
            <span className="rounded-md bg-[#eaf2ff] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#326ad8]">PDF</span>
          </div>
          <span className="mt-4 block h-1.5 w-full rounded-full bg-slate-200" />
          <span className="mt-2 block h-1.5 w-[92%] rounded-full bg-slate-200" />
          <span className="relative mt-2 block h-1.5 w-[80%] rounded-full bg-slate-200"><span className="absolute -inset-y-1 -left-1 w-[62%] rounded bg-[#ffe27a]/70 mix-blend-multiply" /></span>
          <span className="mt-2 block h-1.5 w-[86%] rounded-full bg-slate-200" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            <span className="h-12 rounded-lg bg-[linear-gradient(135deg,#dbe8ff,#eef4ff)]" />
            <span className="h-12 rounded-lg bg-[linear-gradient(135deg,#e7defe,#f4f0ff)]" />
            <span className="h-12 rounded-lg bg-[linear-gradient(135deg,#d6f3e4,#effaf4)]" />
          </div>
          <span className="mt-5 block h-1.5 w-full rounded-full bg-slate-200" />
          <span className="mt-2 block h-1.5 w-[70%] rounded-full bg-slate-200" />
          <div className="mt-6 flex items-end justify-between">
            <div>
              <span className="block h-1 w-16 rounded-full bg-slate-200" />
              <svg viewBox="0 0 120 36" className="mt-1 h-8 w-24 text-[#326ad8]"><path d="M4 26c10-14 16-20 20-14s-6 16 2 12 10-18 16-14 0 14 8 10 8-10 14-8 4 8 12 6 12-6 20-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="depth-signature" /></svg>
            </div>
            <span className="rounded-md border border-dashed border-[#326ad8]/50 px-2 py-1 text-[9px] font-semibold text-[#326ad8]">Sign here</span>
          </div>
        </div>
        <div className="depth-layer depth-layer-toolbar">
          {["T", "✎", "▭", "✓"].map((glyph, index) => <span key={glyph} className={`grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold ${index === 1 ? "bg-[#326ad8] text-white" : "text-slate-500"}`}>{glyph}</span>)}
        </div>
        <div className="depth-layer depth-layer-note">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a6100]">Note</span>
          <span className="mt-1.5 block h-1 w-full rounded-full bg-[#8a6100]/25" />
          <span className="mt-1 block h-1 w-3/4 rounded-full bg-[#8a6100]/25" />
        </div>
        <div className="depth-layer depth-layer-badge">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1f8f64] text-[11px] text-white">✓</span>
          <span><span className="block text-[11px] font-semibold text-[#172033]">Exported</span><span className="block text-[10px] text-slate-500">contract-final.pdf</span></span>
        </div>
      </div>
      <div className="depth-floor" />
    </div>
  );
}
