import { FilePenLine, Highlighter, LockKeyhole, PenLine, ShieldCheck, Signature, Stamp, TextCursorInput } from "lucide-react";
import { CSSProperties, HTMLAttributes, PointerEvent, ReactNode, useCallback, useRef } from "react";

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

const orbitTiles = [
  { icon: TextCursorInput, label: "Edit text", from: "#4c84ee", to: "#2457c0", edge: "#173f94", x: -74, y: -100, z: 70 },
  { icon: Signature, label: "Sign", from: "#8a74f0", to: "#5f45d6", edge: "#43309f", x: 74, y: -66, z: 120 },
  { icon: Highlighter, label: "Highlight", from: "#f2b84b", to: "#d9901a", edge: "#9c6408", x: -78, y: 58, z: 110 },
  { icon: Stamp, label: "Watermark", from: "#34b47f", to: "#1c8a5f", edge: "#126044", x: 74, y: 96, z: 60 },
];

/** Onboarding scene: tool tiles floating at different depths around a page. */
export function ToolOrbit() {
  const { ref, ...handlers } = usePointerDepth<HTMLDivElement>();
  return (
    <div ref={ref} {...handlers} className="depth-scene depth-scene-orbit" aria-hidden>
      <div className="depth-stage">
        <div className="depth-page depth-page-orbit"><span className="block h-2 w-20 rounded-full bg-[#172033]" />{[92, 80, 88, 64, 84, 70].map((width, index) => <span key={index} className="mt-3 block h-1.5 rounded-full bg-slate-200" style={{ width: `${width}%` }} />)}</div>
        {orbitTiles.map(tile => <span key={tile.label} className="depth-orbit-tile" style={{ transform: `translate3d(${tile.x}px, ${tile.y}px, ${tile.z}px)` }}><span className="depth-icon h-12 w-12" style={{ background: `linear-gradient(145deg, ${tile.from}, ${tile.to})`, "--icon-edge": tile.edge, transform: "none" } as CSSProperties}><tile.icon className="h-5 w-5" /></span><span className="mt-1.5 block whitespace-nowrap rounded-full bg-[#0f172a]/85 px-2 py-0.5 text-center text-[10px] font-semibold text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,.7)]">{tile.label}</span></span>)}
      </div>
    </div>
  );
}

/** Onboarding scene: a privacy vault — stacked glass layers sealed by a lock. */
export function PrivacyVault() {
  const { ref, ...handlers } = usePointerDepth<HTMLDivElement>();
  return (
    <div ref={ref} {...handlers} className="depth-scene depth-scene-orbit" aria-hidden>
      <div className="depth-stage">
        {[0, 1, 2, 3].map(index => <div key={index} className="depth-vault-layer" style={{ transform: `translate3d(0, ${-index * 14}px, ${index * 34}px)`, opacity: 0.55 + index * 0.15 }}><span className="h-1.5 w-1/2 rounded-full bg-white/50" /><span className="mt-2 h-1.5 w-1/3 rounded-full bg-white/30" /></div>)}
        <span className="depth-vault-lock" style={{ transform: "translate3d(0, -40px, 170px)" }}><LockKeyhole className="h-8 w-8" /></span>
        <span className="depth-orbit-badge" style={{ transform: "translate3d(-96px, 70px, 120px)" }}><ShieldCheck className="h-4 w-4 text-[#72d5a2]" />On-device</span>
        <span className="depth-orbit-badge" style={{ transform: "translate3d(86px, -110px, 90px)" }}><PenLine className="h-4 w-4 text-[#8eb8ff]" />No public links</span>
      </div>
    </div>
  );
}
