import { usePointerDepth } from "@/components/Depth";
import { Highlighter, LockKeyhole, PenLine, ShieldCheck, Signature, Stamp, TextCursorInput } from "lucide-react";
import type { CSSProperties } from "react";

// Onboarding-only 3D scenes (the shared DocumentStack/TiltCard live in client/src/components/Depth.tsx).

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
