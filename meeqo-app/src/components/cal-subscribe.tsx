import { useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { calendarStatus, endCalendar, getCalendarLink } from "@/lib/meeqo/api";
import { subscribeUrls } from "@/lib/meeqo/ics";
import { mapsPlatform } from "@/lib/meeqo/maps";
import { platform } from "@/lib/meeqo/native";
import { notice } from "@/lib/meeqo/feel";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

function devicePlatform() {
  return mapsPlatform(platform(), typeof navigator === "undefined" ? "" : navigator.userAgent);
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    notice(t("Link kopiert."));
  } catch {
    window.prompt(t("Link kopieren:"), text);
  }
}

/** "Kalender abonnieren": creates the private link and offers the right app for this phone. */
export function CalendarSubscribe({ onChange }: { onChange?: (active: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [fail, setFail] = useState("");
  useEffect(() => {
    void calendarStatus().then((res) => setPath(res.path)).catch(() => undefined);
  }, []);
  async function start() {
    setFail("");
    setOpen(true);
    try {
      const link = await getCalendarLink({ data: {} });
      setPath(link.path);
      onChange?.(true);
    } catch (err) {
      setFail(errText(err));
    }
  }
  const urls = path && typeof window !== "undefined" ? subscribeUrls(window.location.origin, path) : null;
  const os = devicePlatform();
  const button = "flex h-12 w-full items-center justify-center rounded-control px-4 text-sm font-semibold";
  return (
    <>
      <button type="button" onClick={() => void start()} className="inline-flex h-11 items-center gap-2 rounded-control border border-line bg-card px-4 text-sm font-semibold">
        {path ? <CalendarCheck className="h-4 w-4 text-accent" aria-hidden /> : <CalendarPlus className="h-4 w-4" aria-hidden />}
        {path ? t("Kalender-Abo aktiv") : t("Kalender abonnieren")}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={t("Kalender abonnieren")}>
          <div className="card w-full max-w-lg space-y-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-display text-2xl">{t("Kalender abonnieren")}</h2>
            <p className="text-sm text-muted">{t("Treffen, die du veranstaltest oder bei denen du zugesagt hast, erscheinen von selbst in deinem Kalender und bleiben aktuell (etwa stündlich). Offene Anfragen stehen dort als „vorläufig“.")}</p>
            <p className="text-xs text-muted">{t("Im Kalender stehen nur Titel, Zeit, Ort und der Link. Der genaue Treffpunkt nur, wenn du zugesagt bist. Der Link ist privat: Wer ihn hat, sieht diese Termine. In den Einstellungen kannst du ihn ersetzen oder das Abo beenden.")}</p>
            {urls ? (
              <div className="space-y-2">
                {os === "android" ? (
                  <a href={urls.google} target="_blank" rel="noreferrer" className={`${button} bg-accent text-onfill`}>{t("In Google Kalender öffnen")}</a>
                ) : (
                  <a href={urls.webcal} className={`${button} bg-accent text-onfill`}>{os === "ios" ? t("Im iPhone-Kalender abonnieren") : t("Im Kalender abonnieren")}</a>
                )}
                {os === "desktop" ? <a href={urls.google} target="_blank" rel="noreferrer" className={`${button} border border-line bg-card`}>{t("In Google Kalender öffnen")}</a> : null}
                {os === "android" ? <a href={urls.webcal} className={`${button} border border-line bg-card`}>{t("Andere Kalender-App")}</a> : null}
                <button type="button" onClick={() => void copy(urls.https)} className={`${button} border border-line bg-card`}>{t("Link kopieren")}</button>
              </div>
            ) : fail ? (
              <p className="text-sm font-semibold text-accent-deep">{fail}</p>
            ) : (
              <p className="text-sm text-muted">{t("Wird geladen…")}</p>
            )}
            <button type="button" className="h-11 w-full text-sm font-semibold text-muted" onClick={() => setOpen(false)}>{t("Schließen")}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Settings rows: replace the link or end the subscription. */
export function CalendarSettings() {
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void calendarStatus().then((res) => setPath(res.path)).catch(() => setPath(""));
  }, []);
  const urls = path && typeof window !== "undefined" ? subscribeUrls(window.location.origin, path) : null;
  const face = "inline-flex h-10 items-center rounded-control border border-line bg-card px-4 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="card space-y-3 p-4" data-testid="calendar-settings">
      <h2 className="font-display text-2xl">{t("Kalender-Abo")}</h2>
      {path === null ? <p className="text-sm text-muted">{t("Wird geladen…")}</p> : null}
      {path === "" ? <p className="text-sm text-muted">{t("Kein Abo. Starte es unter Meine Termine mit „Kalender abonnieren“.")}</p> : null}
      {urls ? (
        <>
          <p className="text-sm text-muted">{t("Dein Kalender holt deine Treffen über einen privaten Link. Ersetzt du ihn, musst du neu abonnieren; der alte Link geht sofort nicht mehr.")}</p>
          <input readOnly value={urls.https} aria-label={t("Kalender-Adresse")} onFocus={(event) => event.currentTarget.select()} className="h-12 w-full rounded-2xl border border-line bg-sand px-4 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={face} onClick={() => void copy(urls.https)}>{t("Link kopieren")}</button>
            <button
              type="button"
              className={face}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const next = await getCalendarLink({ data: { rotate: true } });
                  setPath(next.path);
                  notice(t("Neuer Link. Der alte funktioniert nicht mehr."));
                } catch (err) {
                  notice(errText(err));
                } finally {
                  setBusy(false);
                }
              }}
            >{t("Link neu erzeugen")}</button>
            <button
              type="button"
              className={face}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await endCalendar();
                  setPath("");
                  notice(t("Abo beendet. Der Link funktioniert nicht mehr."));
                } catch (err) {
                  notice(errText(err));
                } finally {
                  setBusy(false);
                }
              }}
            >{t("Abo beenden")}</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
