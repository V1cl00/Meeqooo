import { useRef, useState, type ReactNode } from "react";
import { buzz } from "@/lib/meeqo/feel";
import { chime } from "@/lib/meeqo/sound";

const HOLD_MS = 650;

/**
 * Hold to commit on touch: a ring fills, then it buzzes and fires. Mouse and keyboard keep a normal click,
 * so nobody is locked out and nothing happens by a stray tap while scrolling.
 */
export function HoldButton({ onCommit, disabled, children, className = "" }: { onCommit: () => void; disabled?: boolean; children: ReactNode; className?: string }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const touch = useRef(false);

  function stop() {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    setProgress(0);
  }

  function tick() {
    const p = Math.min(1, (performance.now() - started.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      stop();
      buzz(25);
      chime();
      onCommit();
      return;
    }
    timer.current = requestAnimationFrame(tick);
  }

  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative inline-flex h-12 select-none items-center justify-center gap-2 rounded-control bg-accent px-5 text-sm font-semibold text-onfill shadow-sm disabled:opacity-50 ${className}`}
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        touch.current = event.pointerType === "touch" || event.pointerType === "pen";
        if (!touch.current || disabled) return;
        started.current = performance.now();
        timer.current = requestAnimationFrame(tick);
      }}
      onPointerUp={() => touch.current && stop()}
      onPointerLeave={() => touch.current && stop()}
      onPointerCancel={() => touch.current && stop()}
      onClick={() => {
        if (touch.current) return;
        buzz(20);
        chime();
        onCommit();
      }}
    >
      <svg viewBox="0 0 36 36" className="h-6 w-6 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round" />
      </svg>
      {children}
    </button>
  );
}
