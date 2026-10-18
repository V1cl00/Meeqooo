import { useEffect, useState } from "react";
import { myEmail, setNotifyChannel, setNotifyEmail, setQuietHours } from "@/lib/meeqo/api";
import { channelValue, NOTIFY_GROUPS, NOTIFY_TYPES } from "@/lib/meeqo/notify-prefs";
import { isNative } from "@/lib/meeqo/native";
import { useLoad } from "@/lib/meeqo/use-load";
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

export function EmailCard({ profile, reload }: { profile: Profile; reload: () => Promise<unknown> | void }) {
  const mail = useLoad(() => myEmail(), []);
  const [on, setOn] = useState(profile.notifyEmail);
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words font-display text-2xl">{mail.data?.email ? t("E-Mails an {0}", mail.data.email) : t("E-Mails")}</h2>
          <p className="mt-1 text-sm text-muted">{t("E-Mail bei Anfragen: Du bekommst eine Mail, wenn jemand dein Treffen anfragt oder ein Host deine Anfrage annimmt oder ablehnt. Dazu Absagen und Änderungen. Eine Mail pro Ereignis, keine Werbung.")}</p>
        </div>
        <Switch
          on={on}
          label={t("E-Mails senden")}
          onChange={async (next) => {
            setOn(next);
            try {
              await setNotifyEmail({ data: { enabled: next } });
              await reload();
            } catch {
              setOn(!next);
            }
          }}
        />
      </div>
      <p className="text-xs text-muted">{on ? t("Welche Arten per Mail kommen, stellst du unten pro Zeile ein.") : t("Aus: keine Mails von MeeQo, außer zum Konto (z. B. Passwort).")}</p>
    </div>
  );
}

/** One row per type: when it fires, and its own Push and E-Mail switch. */
export function NotifyList({ profile }: { profile: Profile }) {
  const [prefs, setPrefs] = useState(profile.notifyPrefs ?? {});
  const [fail, setFail] = useState("");
  async function flip(key: string, channel: "push" | "email", next: boolean) {
    const before = prefs;
    setPrefs({ ...prefs, [key]: { ...prefs[key], [channel]: next } });
    setFail("");
    try {
      await setNotifyChannel({ data: { key, channel, on: next } });
    } catch (err) {
      setPrefs(before);
      setFail(errText(err));
    }
  }
  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="font-display text-2xl">{t("Wann wir dir Bescheid geben")}</h2>
        <p className="text-sm text-muted">{t("Jede Zeile hat ihren eigenen Schalter für Push und E-Mail. Alles erscheint auch in der Glocke in der App.")}</p>
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
              <div className="flex shrink-0 gap-3 text-center text-[11px] font-semibold text-muted">
                <span className="flex flex-col items-center gap-1">
                  <Switch on={channelValue(type, prefs, "push")} label={`${t(type.title)} · ${t("Push")}`} onChange={(next) => void flip(type.key, "push", next)} />
                  {t("Push")}
                </span>
                <span className="flex flex-col items-center gap-1">
                  {type.email === null ? (
                    <span className="grid h-7 w-12 place-items-center text-xs" aria-label={t("Keine E-Mail für diese Art")}>–</span>
                  ) : (
                    <Switch on={channelValue(type, prefs, "email")} disabled={!profile.notifyEmail} label={`${t(type.title)} · ${t("E-Mail")}`} onChange={(next) => void flip(type.key, "email", next)} />
                  )}
                  {t("E-Mail")}
                </span>
              </div>
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
          <p className="text-sm text-muted">{t("In dieser Zeit kommt kein Push. Dringende Änderungen und Absagen kommen trotzdem. E-Mails und die Glocke in der App sind nicht betroffen.")}</p>
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
