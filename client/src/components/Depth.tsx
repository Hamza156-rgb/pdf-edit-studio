import { CSSProperties, HTMLAttributes, PointerEvent, ReactNode, useCallback, useId, useRef } from "react";

/**
 * Lightweight CSS-3D primitives. Everything is driven by CSS custom properties so
 * pointer movement never re-renders React, and all motion is disabled for touch
 * devices and users who prefer reduced motion (see the `.depth-*` rules in index.css).
 */

function canTilt(pointerType: string) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  // Mice tilt on hover; fingers and pens tilt while pressed, which pointer events only report during contact.
  return pointerType !== "mouse" || window.matchMedia("(hover: hover)").matches;
}

/** Writes normalized pointer position (-0.5..0.5) into --px/--py on the element. */
export function usePointerDepth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef(0);
  const onPointerMove = useCallback((event: PointerEvent<T>) => {
    const el = ref.current;
    if (!el || !canTilt(event.pointerType)) return;
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
  return { ref, onPointerMove, onPointerDown: onPointerMove, onPointerLeave, onPointerUp: onPointerLeave, onPointerCancel: onPointerLeave };
}

type TiltCardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode; max?: number; glare?: boolean };

/** A card that tilts toward the pointer with a soft specular glare. */
export function TiltCard({ children, className = "", max = 8, glare = true, style, ...rest }: TiltCardProps) {
  const { ref, ...handlers } = usePointerDepth<HTMLDivElement>();
  return (
    <div
      ref={ref}
      {...handlers}
      className={`depth-tilt ${className}`}
      style={{ "--tilt-max": `${max}deg`, ...style } as CSSProperties}
      {...rest}
    >
      {children}
      {glare && <span aria-hidden className="depth-glare" />}
    </div>
  );
}

/**
 * The Inklyne mark: a tilted page whose ink line runs past its edge into an ink drop.
 * Source artwork: brand/inklyne-icon.svg. Gradient ids are per-instance so hidden copies
 * (e.g. inactive Ionic pages) never break the visible one.
 */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const px = size === "sm" ? 28 : size === "lg" ? 56 : 36;
  return (
    <svg width={px} height={px} viewBox="0 0 1024 1024" role="img" aria-label="Inklyne" className="brand-mark shrink-0" style={{ borderRadius: "22.5%" }}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d3170" /><stop offset=".55" stopColor="#121d47" /><stop offset="1" stopColor="#0a1129" /></linearGradient>
        <radialGradient id={`${id}glow`} cx=".26" cy=".18" r=".8"><stop offset="0" stopColor="#5a85ff" stopOpacity=".55" /><stop offset="1" stopColor="#5a85ff" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}page`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe7f7" /></linearGradient>
        <linearGradient id={`${id}ink`} gradientUnits="userSpaceOnUse" x1="300" y1="0" x2="860" y2="0"><stop offset="0" stopColor="#3b6cf0" /><stop offset=".6" stopColor="#6a5cff" /><stop offset="1" stopColor="#a77bff" /></linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill={`url(#${id}bg)`} />
      <rect width="1024" height="1024" rx="230" fill={`url(#${id}glow)`} />
      <g transform="rotate(-7 500 500)">
        <path d="M300 200h290l130 130v420a46 46 0 0 1-46 46H300a46 46 0 0 1-46-46V246a46 46 0 0 1 46-46z" fill={`url(#${id}page)`} />
        <path d="M590 200v96a34 34 0 0 0 34 34h96z" fill="#bccbec" />
        <rect x="320" y="340" width="200" height="32" rx="16" fill="#b6c5e6" />
        <rect x="320" y="408" width="290" height="32" rx="16" fill="#d0dbf0" />
      </g>
      <path d="M318 642c34-78 76-110 104-86s-10 104 22 106 56-96 92-94 12 90 50 88 70-64 130-64 92 30 116 30" fill="none" stroke={`url(#${id}ink)`} strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="836" cy="622" r="36" fill="#a77bff" />
    </svg>
  );
}

/**
 * The hero scene: a stack of PDF pages floating in perspective, with editing layers
 * (highlight, signature, sticky note, toolbar) hovering at different depths.
 */
export function DocumentStack({ compact = false }: { compact?: boolean }) {
  const { ref, ...handlers } = usePointerDepth<HTMLDivElement>();
  return (
    <div ref={ref} {...handlers} className={`depth-scene ${compact ? "depth-scene-compact" : ""}`} aria-hidden>
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
