import { useEffect, useState } from "react";
import { setNotifyChannel, setQuietHours } from "@/lib/meeqo/api";
import { channelValue, NOTIFY_GROUPS, NOTIFY_TYPES } from "@/lib/meeqo/notify-prefs";
import { isNative } from "@/lib/meeqo/native";
import { notice } from "@/lib/meeqo/feel";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";
import type { Profile } from "@/lib/meeqo/types";

type Status = "on" | "off" | "blocked";

/** A real switch: label for screen readers, clear on/off look. */
export function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none disabled:opacity-40 ${on ? "bg-accent" : "bg-line"}`}
    >
      <span className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Pill({ status }: { status: Status }) {
  const look = status === "on" ? "bg-green text-ink" : status === "blocked" ? "bg-accent-deep text-onfill" : "bg-sand-deep text-ink";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${look}`}>{status === "on" ? t("An") : status === "blocked" ? t("Im Handy blockiert") : t("Aus")}</span>;
}

/** Push permission in plain words, with the real browser or app prompt behind "Jetzt erlauben". */
export function PermissionCard({ profile, onAllow }: { profile: Profile; onAllow: () => Promise<void> }) {
  const [status, setStatus] = useState<Status>(profile.notifyPush ? "on" : "off");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isNative()) {
      setStatus(profile.notifyPush ? "on" : "off");
      return;
    }
    if (typeof Notification === "undefined") return setStatus("off");
    setStatus(Notification.permission === "denied" ? "blocked" : Notification.permission === "granted" && profile.notifyPush ? "on" : "off");
  }, [profile.notifyPush]);
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{t("Benachrichtigungen")}</h2>
        <Pill status={status} />
      </div>
      <p className="text-sm text-muted">{t("Damit du z. B. erfährst, wenn deine Anfrage angenommen wurde oder sich ein Treffen ändert.")}</p>
      {status !== "on" ? (
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onAllow(); } finally { setBusy(false); } }} className="inline-flex h-12 w-full items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill disabled:opacity-50">
          {t("Jetzt erlauben")}
        </button>
      ) : null}
      {status === "blocked" ? (
        <div className="space-y-1 rounded-control bg-sand p-3 text-sm">
          <p className="font-semibold">{t("Wieder einschalten:")}</p>
          <p>{t("Android (Chrome): Schloss-Symbol neben der Adresse → Berechtigungen → Benachrichtigungen → Zulassen. Dann hier „Jetzt erlauben“.")}</p>
          <p>{t("iPhone: MeeQo zum Home-Bildschirm hinzufügen, von dort öffnen, dann Einstellungen → Mitteilungen → MeeQo → Erlauben.")}</p>
        </div>
      ) : null}
    </div>
  );
}

/** One row per type: when it fires, and its own push switch. */
export function NotifyList({ profile }: { profile: Profile }) {
  const [prefs, setPrefs] = useState(profile.notifyPrefs ?? {});
  const [fail, setFail] = useState("");
  async function flip(key: string, next: boolean) {
    const before = prefs;
    setPrefs({ ...prefs, [key]: { push: next } });
    setFail("");
    try {
      await setNotifyChannel({ data: { key, on: next } });
    } catch (err) {
      setPrefs(before);
      setFail(errText(err));
    }
  }
  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="font-display text-2xl">{t("Wann wir dir Bescheid geben")}</h2>
        <p className="text-sm text-muted">{t("Jede Zeile hat ihren eigenen Schalter. Alles erscheint auch in der Glocke in der App.")}</p>
      </div>
      {NOTIFY_GROUPS.map((group) => (
        <section key={group} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t(group)}</h3>
          {NOTIFY_TYPES.filter((type) => type.group === group).map((type) => (
            <div key={type.key} className="flex items-start gap-3 border-t border-line pt-3" data-notify={type.key}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t(type.title)}</p>
                <p className="text-xs text-muted">{t(type.when)}</p>
              </div>
              <Switch on={channelValue(type, prefs)} label={t(type.title)} onChange={(next) => void flip(type.key, next)} />
            </div>
          ))}
        </section>
      ))}
      {fail ? <p className="text-sm font-semibold text-accent-deep">{fail}</p> : null}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function QuietCard({ profile }: { profile: Profile }) {
  const [quiet, setQuiet] = useState(profile.quiet ?? { on: true, from: 22, to: 8 });
  async function save(next: typeof quiet) {
    const before = quiet;
    setQuiet(next);
    try {
      await setQuietHours({ data: next });
    } catch (err) {
      setQuiet(before);
      notice(errText(err));
    }
  }
  const select = "h-10 rounded-control border border-line bg-card px-3 text-sm font-semibold";
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">{t("Ruhezeiten")}</h2>
          <p className="text-sm text-muted">{t("In dieser Zeit kommt keine Benachrichtigung aufs Handy. Dringende Änderungen und Absagen kommen trotzdem. Die Glocke in der App sammelt alles.")}</p>
        </div>
        <Switch on={quiet.on} label={t("Ruhezeiten")} onChange={(on) => void save({ ...quiet, on })} />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span>{t("Von")}</span>
        <select aria-label={t("Ruhezeit von")} className={select} disabled={!quiet.on} value={quiet.from} onChange={(event) => void save({ ...quiet, from: Number(event.target.value) })}>
          {HOURS.map((hour) => <option key={hour} value={hour}>{t("{0} Uhr", hour)}</option>)}
        </select>
        <span>{t("bis")}</span>
        <select aria-label={t("Ruhezeit bis")} className={select} disabled={!quiet.on} value={quiet.to} onChange={(event) => void save({ ...quiet, to: Number(event.target.value) })}>
          {HOURS.map((hour) => <option key={hour} value={hour}>{t("{0} Uhr", hour)}</option>)}
        </select>
      </div>
    </div>
  );
}
