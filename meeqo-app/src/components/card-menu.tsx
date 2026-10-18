import { useState } from "react";
import { requestJoin } from "@/lib/meeqo/api";
import { notice } from "@/lib/meeqo/feel";
import { RouteLink } from "@/components/route-link";
import { errText, formatWhen, MOODS } from "@/lib/meeqo/labels";
import type { ActivityCard as Activity } from "@/lib/meeqo/types";
import { activityLink, openShare, ShareSheet } from "@/components/share";
import { useMe } from "@/components/shell";
import { isPhotoMissing, PhotoMissing } from "@/components/photo";
import { t } from "@/lib/meeqo/i18n";

const pill = "inline-flex h-12 w-full items-center justify-center rounded-control border border-line bg-card px-4 text-sm font-semibold text-ink";

/** Quick actions for a meetup without opening it: request with a mood, share, route, hide. Not about people, only about the meetup. */
export function CardSheet({ item, onClose, onHide, onChanged }: { item: Activity; onClose: () => void; onHide?: () => void; onChanged?: () => void }) {
  const [mood, setMood] = useState<string>(MOODS[0]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [share, setShare] = useState(false);
  const [needPhoto, setNeedPhoto] = useState(false);
  const { profile } = useMe();
  // Mood only for request-based meetups; organizer events and instant booking have no request to read.
  const askMood = item.area !== "event" && item.bookingMode !== "instant";
  const canRequest = !item.isHost && !item.myStatus && !item.cancelled && item.spotsLeft > 0;

  async function request(photoJustAdded = false) {
    if (!photoJustAdded && profile && !profile.avatarUrl) {
      setNeedPhoto(true);
      return;
    }
    setBusy(true);
    setFail("");
    try {
      const result = await requestJoin({ data: { id: item.id, mood: askMood ? mood : "" } });
      notice(result.status === "accepted" ? "Du bist dabei." : t("Anfrage ist raus."));
      onChanged?.();
      onClose();
    } catch (err) {
      if (isPhotoMissing(err)) setNeedPhoto(true);
      else setFail(errText(err));
      setBusy(false);
    }
  }

  const payload = { title: item.title, text: t("{0} · {1} · {2}", item.title, formatWhen(item.startsAt), item.placeName), url: activityLink(item.id), activityId: item.id };

  if (share) {
    return (
      <ShareSheet
        open
        {...payload}
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
            {askMood ? <>
            <p className="text-sm font-semibold">{t("Was erwartest du?")}</p>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((option) => (
                <button key={option} type="button" onClick={() => setMood(option)} className={`inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${mood === option ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>{t(option)}</button>
              ))}
            </div>
            </> : null}
            <button type="button" disabled={busy} onClick={() => void request()} className="inline-flex h-12 w-full items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill disabled:opacity-50">
              {item.bookingMode === "instant" ? t("Sofort dabei") : t("Anfragen")}
            </button>
          </div>
        ) : null}
        {needPhoto ? <PhotoMissing onDone={() => { setNeedPhoto(false); void request(true); }} /> : null}
        {item.myStatus === "pending" ? <p className="text-sm font-semibold">{t("Du hast schon angefragt.")}</p> : null}
        {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={pill} onClick={() => void openShare(payload, () => setShare(true))}>{t("Teilen")}</button>
          <RouteLink className={pill} target={{ lat: item.lat, lng: item.lng, label: item.placeName, address: `${item.placeName}, ${item.city}` }}>{t("Route")}</RouteLink>
        </div>
        {onHide && !item.isHost ? (
          <button type="button" className={pill} onClick={() => { onHide(); onClose(); }}>{t("Ausblenden")}</button>
        ) : null}
        <button type="button" className={`${pill} border-0 text-muted`} onClick={onClose}>{t("Schließen")}</button>
      </div>
    </div>
  );
}
