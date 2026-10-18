import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, MessageCircle, Send, Users, Zap } from "lucide-react";
import { buzz } from "@/lib/meeqo/feel";
import { chime } from "@/lib/meeqo/sound";
import { t } from "@/lib/meeqo/i18n";

const HOLD_MS = 650;
const HINT_KEY = "meeqo-hold-hint";

/** Room the floating bar takes, so the page can pad its end and nothing hides behind it. */
export const ACTION_BAR_PAD = "pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:pb-28";

/** Bar above the tab bar: info on the left, one action on the right. */
export function ActionBar({ info, sub, children, testId }: { info: ReactNode; sub?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId ?? "action-bar"} className="fixed inset-x-0 bottom-[calc(4.8rem+max(0.6rem,env(safe-area-inset-bottom)))] z-20 px-3 md:bottom-6">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-[16px] border-t border-line bg-sand/90 px-3 py-2.5 shadow-[0_-1px_0_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-sand">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">{info}</p>
          {sub ? <p className="truncate text-xs text-muted">{sub}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

type Kind = "request" | "instant" | "waitlist" | "contact";

const LABELS: Record<Kind, string> = { request: "Anfragen", instant: "Jetzt buchen", waitlist: "Voll · Warteliste", contact: "Kontakt anfragen" };

/**
 * Hold to request on touch: the fill sweeps across the button, then it buzzes, the icon turns into a check
 * and the label says "Angefragt". Mouse, Enter and Space commit at once, so nobody is locked out.
 */
export function RequestButton({ kind, disabled, onCommit, initialProgress }: { kind: Kind; disabled?: boolean; onCommit: () => void; initialProgress?: number }) {
  const [progress, setProgress] = useState(initialProgress ?? 0);
  const [sent, setSent] = useState(false);
  const [hint, setHint] = useState(false);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const touch = useRef(false);
  const hintTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY) && window.matchMedia?.("(pointer: coarse)").matches) {
        showHint();
        localStorage.setItem(HINT_KEY, "1");
      }
    } catch {
      // no storage: no first-time hint
    }
    return () => {
      if (timer.current) cancelAnimationFrame(timer.current);
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    };
  }, []);

  function showHint() {
    setHint(true);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 2200);
  }

  function commit() {
    setSent(true);
    setHint(false);
    buzz(30);
    chime();
    onCommit();
  }

  function stop(early: boolean) {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    if (early && progress < 1) showHint();
    setProgress(0);
  }

  function tick() {
    const p = Math.min(1, (performance.now() - started.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      if (timer.current) cancelAnimationFrame(timer.current);
      timer.current = null;
      commit();
      return;
    }
    timer.current = requestAnimationFrame(tick);
  }

  const Icon = sent ? Check : kind === "instant" ? Zap : kind === "waitlist" ? Users : Send;
  return (
    <div className="relative">
      {hint ? (
        <span role="status" className="absolute -top-11 right-0 whitespace-nowrap rounded-control bg-ink px-3 py-1.5 text-xs font-semibold text-onaccent shadow-lg after:absolute after:-bottom-1 after:right-6 after:h-2 after:w-2 after:rotate-45 after:bg-ink">
          {t("Halten zum Anfragen")}
        </span>
      ) : null}
      <button
        type="button"
        data-testid="request-button"
        disabled={disabled || sent}
        aria-label={sent ? t("Angefragt") : `${t(LABELS[kind])} · ${t("Halten zum Anfragen")}`}
        className="relative inline-flex h-[52px] min-w-[9.5rem] select-none items-center justify-center gap-2 overflow-hidden rounded-[12px] bg-accent px-5 text-[15px] font-semibold text-onfill shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-90"
        style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          touch.current = event.pointerType === "touch" || event.pointerType === "pen";
          if (!touch.current || disabled || sent) return;
          started.current = performance.now();
          timer.current = requestAnimationFrame(tick);
        }}
        onPointerUp={() => touch.current && timer.current && stop(true)}
        onPointerLeave={() => touch.current && timer.current && stop(false)}
        onPointerCancel={() => touch.current && stop(false)}
        onClick={() => {
          if (touch.current || sent) return;
          commit();
        }}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-accent-deep" style={{ width: `${(sent ? 1 : progress) * 100}%` }} />
        <Icon aria-hidden="true" className={`relative h-[18px] w-[18px] transition-transform duration-300 motion-reduce:transition-none ${sent ? "scale-110" : ""}`} strokeWidth={2.4} />
        <span className="relative">{sent ? t("Angefragt") : t(LABELS[kind])}</span>
      </button>
    </div>
  );
}

const secondary = "inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] border border-line bg-card px-4 text-sm font-semibold text-ink disabled:opacity-50";
const primary = "inline-flex h-[52px] items-center justify-center gap-2 rounded-[12px] bg-accent px-5 text-[15px] font-semibold text-onfill";

export function WithdrawButton({ onConfirm, disabled, label }: { onConfirm: () => void; disabled?: boolean; label: string }) {
  const [ask, setAsk] = useState(false);
  // The finger that just finished the hold lifts here: ignore that release so it does not open "Zurückziehen?".
  const born = useRef(Date.now());
  return ask ? (
    <span className="flex gap-1.5">
      <button type="button" className={`${secondary} !border-ink`} disabled={disabled} onClick={onConfirm}>{t("Ja")}</button>
      <button type="button" className={secondary} onClick={() => setAsk(false)}>{t("Nein")}</button>
    </span>
  ) : (
    <button type="button" className={secondary} disabled={disabled} onClick={() => { if (Date.now() - born.current > 900) setAsk(true); }}>{label}</button>
  );
}

export function ChatButton({ id, group }: { id: string; group: boolean }) {
  return (
    <Link to="/chat/$id" params={{ id }} className={primary}>
      <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
      {group ? t("Gruppenchat") : t("Chat")}
    </Link>
  );
}

export function ManageButton({ count }: { count: number }) {
  return (
    <Link to="/requests" className={primary}>
      {t("Anfragen verwalten · {0}", count)}
    </Link>
  );
}

export function ChatIconLink({ id }: { id: string }) {
  return (
    <Link to="/chat/$id" params={{ id }} aria-label={t("Gruppenchat")} className="grid h-11 w-11 place-items-center rounded-[12px] border border-line bg-card text-ink">
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
}
