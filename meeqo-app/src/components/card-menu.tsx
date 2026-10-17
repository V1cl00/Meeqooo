import { useState } from "react";
import { requestJoin } from "@/lib/meeqo/api";
import { notice } from "@/lib/meeqo/feel";
import { routeUrl } from "@/lib/meeqo/ics";
import { errText, formatWhen, MOODS } from "@/lib/meeqo/labels";
import type { ActivityCard as Activity } from "@/lib/meeqo/types";
import { ShareSheet } from "@/components/share";
import { t } from "@/lib/meeqo/i18n";

const pill = "inline-flex h-12 w-full items-center justify-center rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink";

/** Quick actions for a meetup without opening it: request with a mood, share, route, hide. Not about people, only about the meetup. */
export function CardSheet({ item, onClose, onHide, onChanged }: { item: Activity; onClose: () => void; onHide?: () => void; onChanged?: () => void }) {
  const [mood, setMood] = useState<string>(MOODS[0]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [share, setShare] = useState(false);
  const canRequest = !item.isHost && !item.myStatus && !item.cancelled && item.spotsLeft > 0;

  async function request() {
    setBusy(true);
    setFail("");
    try {
      const result = await requestJoin({ data: { id: item.id, mood } });
      notice(result.status === "accepted" ? "Du bist dabei." : t("Anfrage ist raus."));
      onChanged?.();
      onClose();
    } catch (err) {
      setFail(errText(err));
      setBusy(false);
    }
  }

  if (share) {
    return (
      <ShareSheet
        open
        title={item.title}
        text={t("MeeQo: {0}\n{1}\n{2}, {3}\nMit {4}.", item.title, formatWhen(item.startsAt), item.placeName, item.city, item.hostName)}
        onClose={() => {
          setShare(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="card w-full max-w-lg space-y-3 p-4" onClick={(event) => event.stopPropagation()}>
        <div>
          <h2 className="font-display text-2xl leading-tight">{item.title}</h2>
          <p className="text-sm text-muted">{formatWhen(item.startsAt)} · {item.placeName}</p>
        </div>
        {canRequest ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("Was erwartest du?")}</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((option) => (
                <button key={option} type="button" onClick={() => setMood(option)} className={`inline-flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold ${mood === option ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>{t(option)}</button>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={request} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-onfill disabled:opacity-50">
              {item.bookingMode === "instant" ? t("Sofort dabei") : t("Anfragen")}
            </button>
          </div>
        ) : null}
        {item.myStatus === "pending" ? <p className="text-sm font-semibold">{t("Du hast schon angefragt.")}</p> : null}
        {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={pill} onClick={() => setShare(true)}>{t("Teilen")}</button>
          <a className={pill} href={routeUrl(item.lat, item.lng)} target="_blank" rel="noopener noreferrer">{t("Weg")}</a>
        </div>
        {onHide && !item.isHost ? (
          <button type="button" className={pill} onClick={() => { onHide(); onClose(); }}>{t("Ausblenden")}</button>
        ) : null}
        <button type="button" className={`${pill} border-0 text-muted`} onClick={onClose}>{t("Schließen")}</button>
      </div>
    </div>
  );
}
