import { useEffect, useState } from "react";
import { shareText } from "@/lib/meeqo/native";
import { t } from "@/lib/meeqo/i18n";

export type SharePayload = {
  title: string;
  text: string;
  /** Page link. Shared as a real URL so chats build a preview card from it. */
  url?: string;
  /** Activity id: enables the preview image and the story image. */
  activityId?: string;
};

/** Absolute link to an activity, for chats and the system share sheet. */
export function activityLink(id: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/activity/${encodeURIComponent(id)}`;
}

/**
 * The system share sheet where there is one (Capacitor app, phones, some desktops); otherwise our own sheet.
 * Call it straight from the tap handler so the browser still counts it as a user gesture.
 */
export async function openShare(payload: SharePayload, fallback: () => void) {
  try {
    if (await shareText(payload.title, payload.text, payload.url)) return;
  } catch (err) {
    // The person closed the system sheet: that is an answer, not an error.
    if ((err as Error)?.name === "AbortError") return;
  }
  fallback();
}

const channel = "flex flex-col items-center gap-1.5 rounded-2xl p-2 text-xs font-semibold text-ink active:bg-sand-deep";
const dot = "flex h-12 w-12 items-center justify-center rounded-full text-white";

export function ShareSheet({ open, title, text, url, activityId, onClose }: SharePayload & { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);
  if (!open) return null;
  const link = url ?? "";
  const full = link ? `${text}\n${link}` : text;
  const channels = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(full)}`, color: "#25D366", icon: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm4.4 12.4c-.2.5-1.1 1-1.6 1-.4.1-.9.1-1.5-.1-2.6-1-4.3-3.6-4.4-3.8-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.1 0 .4 0 .5.4l.7 1.7c.1.1.1.3 0 .4l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1.9 2 1.2 2.3 1.3.3.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.3.1.1.1.6-.1 1.2Z" },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link || text)}&text=${encodeURIComponent(link ? text : "")}`, color: "#2AABEE", icon: "M20.7 4.3 3.4 11c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.1-2 4.4 3.2c.8.4 1.4.2 1.6-.8l2.9-13.6c.3-1.2-.5-1.7-1.3-1.4ZM8.5 13.6l9.6-6.1c.5-.3.9-.1.5.2l-8.2 7.4-.3 3.4-1.6-4.9Z" },
    { name: t("E-Mail"), href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(full)}`, color: "#6f6159", icon: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 1.5V8l8 5 8-5v-.5H4Z" },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(link || text);
    } catch {
      const area = document.createElement("textarea");
      area.value = link || text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function story() {
    if (!activityId) return;
    setStoryBusy(true);
    const src = `/og/activity/${encodeURIComponent(activityId)}?format=story`;
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "meeqo-story.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: link });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = "meeqo-story.jpg";
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(href), 4000);
      }
    } catch {
      /* closed or blocked: nothing to do */
    }
    setStoryBusy(false);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("Teilen")}>
      <div className="card w-full max-w-lg space-y-4 p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{t("Teilen")}</h2>
          <button type="button" className="inline-flex h-10 items-center rounded-control border-2 border-line bg-card px-3.5 text-sm font-semibold" onClick={onClose}>{t("Schließen")}</button>
        </div>
        {activityId ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-sand">
            <img src={`/og/activity/${encodeURIComponent(activityId)}`} alt="" className="block aspect-[1200/630] w-full object-cover" />
            <p className="truncate px-3 py-2 text-xs text-muted">{link.replace(/^https?:\/\//, "")}</p>
          </div>
        ) : (
          <p className="line-clamp-3 whitespace-pre-line rounded-2xl bg-sand p-3 text-sm text-muted">{text}</p>
        )}
        <div className="grid grid-cols-4 gap-1">
          <button type="button" className={channel} onClick={copy} aria-live="polite">
            <span className={`${dot} ${copied ? "bg-friend" : "bg-ink"}`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {copied ? <path d="m5 12 5 5 9-10" /> : <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>}
              </svg>
            </span>
            {copied ? t("Kopiert") : link ? t("Link kopieren") : t("Kopieren")}
          </button>
          {channels.map((item) => (
            <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className={channel} onClick={() => window.setTimeout(onClose, 300)}>
              <span className={dot} style={{ background: item.color }}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden><path d={item.icon} /></svg>
              </span>
              {item.name}
            </a>
          ))}
        </div>
        {copied ? <p className="text-center text-sm font-semibold text-friend">{t("Link kopiert. Füg ihn in jedem Chat ein.")}</p> : null}
        {activityId ? (
          <button type="button" disabled={storyBusy} onClick={story} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-control border-2 border-line bg-card px-4 text-sm font-semibold disabled:opacity-50">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10 18h4" /></svg>
            {storyBusy ? t("Story-Bild wird erstellt …") : t("Story-Bild für Instagram & Co.")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
