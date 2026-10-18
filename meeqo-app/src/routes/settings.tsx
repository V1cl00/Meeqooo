import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, face, Field, Note, TextArea } from "@/components/bits";
import { Shell, useMe } from "@/components/shell";
import { adminStatus, deleteAccount, withdrawSensitiveConsent, exportMyData, getCalendarLink, setNotifyEmail, designTheme, listBlocked, listHidden, pushKey, resetTheme, savePush, setLocation, setNotify, setRadius, unblockUser, unhideActivity } from "@/lib/meeqo/api";
import { authEnabled, signOut } from "@/lib/auth/client";
import { errText, formatWhen, RADIUS_OPTIONS } from "@/lib/meeqo/labels";
import { notice } from "@/lib/meeqo/feel";
import { useLoad } from "@/lib/meeqo/use-load";
import { isNative, registerNativePush } from "@/lib/meeqo/native";
import { setNotifyPrefs } from "@/lib/meeqo/round3";
import { chime, setSound, soundOn } from "@/lib/meeqo/sound";
import { useNavigate } from "@tanstack/react-router";
import { setLang, t, useLang } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  return (
    <Shell>
      <Settings />
    </Shell>
  );
}

function Settings() {
  const { profile, reload } = useMe();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const hidden = useLoad(() => listHidden(), []);
  const blocked = useLoad(() => listBlocked(), []);
  const admin = useLoad(() => adminStatus(), []);
  const [confirm, setConfirm] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const lang = useLang();
  const navigate = useNavigate();
  const [calendar, setCalendar] = useState("");
  if (!profile) return null;

  async function withdraw() {
    setPending(true);
    try {
      await withdrawSensitiveConsent();
      await reload();
      notice(t("Widerrufen. Die Angaben sind gelöscht."));
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  async function locate() {
    setError("");
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const result = await setLocation({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          await reload();
          notice(result.city ? `Standort: ${result.city}` : "Standort gespeichert.");
        } catch (err) {
          setError(errText(err));
        }
      },
      () => setError(t("Standort nicht freigegeben.")),
    );
  }

  async function push() {
    if (isNative()) {
      try {
        const result = await registerNativePush((path) => void navigate({ to: path }));
        await setNotify({ data: { enabled: result === "granted" } });
        await reload();
        setNote(result === "granted" ? t("Mitteilungen an, auch wenn MeeQo zu ist.") : t("Der Browser hat nicht zugestimmt."));
      } catch (err) {
        setError(errText(err));
      }
      return;
    }
    if (typeof Notification === "undefined") {
      setError("Dieser Browser kann keine Mitteilungen zeigen.");
      return;
    }
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    await setNotify({ data: { enabled } });
    let background = false;
    if (enabled && "serviceWorker" in navigator && "PushManager" in window) {
      try {
        const { key } = await pushKey();
        if (key) {
          const registration = await navigator.serviceWorker.register("/sw.js");
          const padded = key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (key.length % 4)) % 4);
          const raw = atob(padded);
          const applicationServerKey = Uint8Array.from(raw, (char) => char.charCodeAt(0));
          const sub = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
          const json = sub.toJSON();
          await savePush({ data: { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } });
          background = true;
        }
      } catch (err) {
        setError(errText(err));
      }
    }
    await reload();
    notice(enabled ? (background ? t("Mitteilungen an, auch wenn MeeQo zu ist.") : "Mitteilungen an, solange MeeQo offen ist.") : "Mitteilungen bleiben aus.");
    if (!enabled) setError(t("Der Browser hat nicht zugestimmt."));
  }

  async function erase() {
    setError("");
    try {
      await deleteAccount({ data: { confirm } });
      await signOut("/login");
    } catch (err) {
      setError(errText(err));
    }
  }

  async function design(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await designTheme({ data: { note } });
      await reload();
      notice(result.source === "ai" ? t("„{0}“ ist an.", result.theme.name) : t("„{0}“ ist an. Die KI war gerade nicht da, die Farben kommen aus deinen Worten.", result.theme.name));
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Einstellungen")}</h1>
      <section className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Sprache")}</h2>
        <div className="flex gap-2" role="group" aria-label={t("Sprache")}>
          {([["de", "Deutsch"], ["en", "English"]] as const).map(([code, name]) => (
            <button key={code} type="button" lang={code} aria-pressed={lang === code} onClick={() => setLang(code)} className={`inline-flex h-10 items-center rounded-control border-2 px-5 text-sm font-semibold ${lang === code ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>{name}</button>
          ))}
        </div>
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Sensible Angaben")}</h2>
        <p className="text-sm text-muted">{t("Angaben wie „Queer“ oder „Queerfreundlich“ am eigenen Profil speichern wir nur mit deiner ausdrücklichen Einwilligung.")}</p>
        {profile.sensitiveConsent ? (
          <>
            <p className="text-sm font-semibold">{t("Du hast eingewilligt.")}</p>
            <Button type="button" tone="ghost" disabled={pending} onClick={withdraw}>{t("Einwilligung widerrufen und Angaben löschen")}</Button>
          </>
        ) : (
          <p className="text-sm font-semibold">{t("Keine Einwilligung gegeben. Es sind keine solchen Angaben gespeichert.")}</p>
        )}
      </section>
      <form onSubmit={design} className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Dein Design")}</h2>
        <p className="text-sm text-muted">{t("Beschreib in einem Satz, wie MeeQo aussehen soll. Die KI setzt Farben, Schrift und Ecken. Der Text bleibt lesbar, nur für dich.")}</p>
        {profile.theme ? (
          <div className="flex items-center gap-3">
            <span className="font-semibold">{profile.theme.name}</span>
            <span className="flex gap-1.5" aria-hidden>
              {[profile.theme.sand, profile.theme.accent, profile.theme.friend, profile.theme.ink].map((color) => (
                <span key={color} className="h-6 w-6 rounded-full border border-line" style={{ background: color }} />
              ))}
            </span>
          </div>
        ) : null}
        <Field label={t("Wie soll es sich anfühlen?")}>
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("Zum Beispiel: ruhig, meerblau, weiche Ecken")} maxLength={240} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || note.trim().length < 2}>{pending ? t("Wird gestaltet…") : t("Mit KI gestalten")}</Button>
          {profile.theme ? (
            <Button
              type="button"
              tone="ghost"
              onClick={async () => {
                await resetTheme();
                await reload();
                notice(t("Wieder das MeeQo-Design."));
              }}
            >{t("Zurück zu MeeQo")}</Button>
          ) : null}
        </div>
      </form>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Radius")}</h2>
        <p className="text-sm text-muted">{t("Gilt für Feed und Suche. Gerade {0} km um {1}.", profile.radiusKm, profile.city || t("deinen Ort"))}</p>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={async () => {
                await setRadius({ data: { radiusKm: item } });
                await reload();
              }}
              className={`inline-flex h-10 items-center rounded-control border px-3 text-sm font-semibold ${profile.radiusKm === item ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}
            >
              {t("{0} km", item)}</button>
          ))}
        </div>
        <Button type="button" tone="ghost" onClick={locate}>{t("Standort vom Handy")}</Button>
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Mitteilungen")}</h2>
        <p className="text-sm text-muted">{t("Anfragen, Zusagen und Erinnerungen. Mitteilungen kommen auch bei geschlossener App, wenn dein Browser und der Server es können. Sonst nur, solange MeeQo offen ist.")}</p>
        <Button type="button" onClick={push}>{profile.notifyPush ? t("Mitteilungen sind an") : t("Mitteilungen erlauben")}</Button>
        <Button
          type="button"
          tone="ghost"
          onClick={async () => {
            await setNotifyEmail({ data: { enabled: !profile.notifyEmail } });
            await reload();
            notice(profile.notifyEmail ? t("Keine Mails mehr zu Anfragen und Zusagen.") : t("Mails zu Anfragen und Zusagen sind an."));
          }}
        >
          {profile.notifyEmail ? t("Mails zu Anfragen: an") : t("Mails zu Anfragen: aus")}
        </Button>
        <div className="space-y-2 border-t border-line pt-3">
          <PrefSwitch
            label={t("Erinnerung 2 Stunden vorher")}
            hint={t("Und danach einmal „Wie war's?“.")}
            on={profile.notifyReminder}
            onChange={async (next) => { await setNotifyPrefs({ data: { reminder: next } }); await reload(); }}
          />
          <PrefSwitch
            label={t("Letzter Platz in deiner Nähe")}
            hint={t("Höchstens einmal am Tag, nur passend zu deinen Interessen.")}
            on={profile.notifyNearby}
            onChange={async (next) => { await setNotifyPrefs({ data: { nearby: next } }); await reload(); }}
          />
          <PrefSwitch
            label={t("MeeQo-Klang")}
            hint={t("Ein kurzer Ton, wenn du anfragst oder zusagst. Nur auf diesem Gerät.")}
            on={soundOn()}
            onChange={async (next) => { setSound(next); if (next) chime(true); }}
          />
        </div>
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Ausgeblendet")}</h2>
        <p className="text-sm text-muted">{t("Diese Aktivitäten siehst du nicht im Feed, in der Suche, in Communities und bei Vorschlägen. Zusagen und eigene Termine bleiben trotzdem unter Meine Aktivitäten.")}</p>
        {hidden.loading ? <p className="text-sm text-muted">{t("Wird geladen…")}</p> : null}
        {hidden.error ? <Note>{hidden.error}</Note> : null}
        {(hidden.data ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <div>
              <Link to="/activity/$id" params={{ id: item.id }} className="font-semibold">{item.title}</Link>
              <p className="text-sm text-muted">{formatWhen(item.startsAt)} · {item.city}</p>
            </div>
            <button
              type="button"
              className={face}
              onClick={async () => {
                try {
                  await unhideActivity({ data: { id: item.id } });
                  hidden.reload();
                  notice("Wieder sichtbar.");
                  setError("");
                } catch (err) {
                  setError(errText(err));
                }
              }}
            >{t("Wieder zeigen")}</button>
          </div>
        ))}
        {!hidden.loading && (hidden.data ?? []).length === 0 ? <p className="text-sm text-muted">{t("Nichts ausgeblendet.")}</p> : null}
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Blockiert")}</h2>
        <p className="text-sm text-muted">{t("Blockierte Personen sehen dich nicht, können dich nicht anfragen und dir nicht schreiben. Das gilt für beide Seiten.")}</p>
        {(blocked.data ?? []).map((person) => (
          <div key={person.id} className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="font-semibold">{person.name}</span>
            <button
              type="button"
              className={face}
              onClick={async () => {
                try {
                  await unblockUser({ data: { userId: person.id } });
                  blocked.reload();
                  notice("Nicht mehr blockiert.");
                } catch (err) {
                  setError(errText(err));
                }
              }}
            >{t("Entblocken")}</button>
          </div>
        ))}
        {!blocked.loading && (blocked.data ?? []).length === 0 ? <p className="text-sm text-muted">{t("Niemand blockiert.")}</p> : null}
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Kalender abonnieren")}</h2>
        <p className="text-sm text-muted">{t("Deine zugesagten und eigenen Treffen erscheinen von selbst im Kalender deines Handys. Wer den Link kennt, sieht die Titel und Orte. Du kannst ihn jederzeit ersetzen.")}</p>
        {calendar ? (
          <div className="space-y-2">
            <input readOnly value={`${window.location.origin}${calendar}`} aria-label={t("Kalender-Adresse")} onFocus={(event) => event.currentTarget.select()} className="h-12 w-full rounded-2xl border border-line bg-sand px-4 text-sm" />
            <div className="flex flex-wrap gap-2">
              <a className={face} href={`webcal://${window.location.host}${calendar}`}>{t("Im Kalender öffnen")}</a>
              <button
                type="button"
                className={face}
                onClick={async () => {
                  const next = await getCalendarLink({ data: { rotate: true } });
                  setCalendar(next.path);
                  notice(t("Neuer Link. Der alte funktioniert nicht mehr."));
                }}
              >{t("Neuen Link erzeugen")}</button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            tone="ghost"
            onClick={async () => {
              try {
                const link = await getCalendarLink({ data: {} });
                setCalendar(link.path);
              } catch (err) {
                setError(errText(err));
              }
            }}
          >{t("Link anzeigen")}</Button>
        )}
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">{t("Meine Daten")}</h2>
        <p className="text-sm text-muted">{t("Lade alles herunter, was MeeQo über dich gespeichert hat, als Datei. Nachrichten anderer Personen sind nicht dabei.")}</p>
        <Button
          type="button"
          tone="ghost"
          onClick={async () => {
            try {
              const file = await exportMyData();
              const link = document.createElement("a");
              link.href = URL.createObjectURL(new Blob([file.json], { type: "application/json" }));
              link.download = file.filename;
              link.click();
              URL.revokeObjectURL(link.href);
              notice(t("Datei ist heruntergeladen."));
            } catch (err) {
              setError(errText(err));
            }
          }}
        >{t("Daten herunterladen")}</Button>
      </div>
      <div className="card space-y-3 border-2 !border-ink p-4">
        <h2 className="font-display text-2xl">{t("Konto löschen")}</h2>
        <p className="text-sm text-muted">{t("Löscht dein Profil, deine Treffen, Anzeigen, Chats, Bewertungen und Fotos. Das lässt sich nicht rückgängig machen.")}</p>
        <Field label={t("Tipp LÖSCHEN zur Bestätigung")}>
          <input value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-12 w-full rounded-2xl border border-line bg-sand px-4 text-base outline-none focus:border-accent" autoComplete="off" />
        </Field>
        <Button type="button" tone="ink" disabled={!["LÖSCHEN", "DELETE"].includes(confirm.trim().toUpperCase())} onClick={erase}>{t("Konto endgültig löschen")}</Button>
      </div>
      <p className="flex flex-wrap gap-4 pb-4 text-sm text-muted">
        <Link to="/datenschutz" className="underline">{t("Datenschutz")}</Link>
        <Link to="/impressum" className="underline">{t("Impressum")}</Link>
        <Link to="/nutzungsbedingungen" className="underline">{t("Nutzungsbedingungen")}</Link>
        <Link to="/regeln" className="underline">{t("Regeln")}</Link>
        <Link to="/support" className="underline">{t("Hilfe")}</Link>
        {admin.data?.admin ? <Link to="/admin/meldungen" className="font-semibold text-ink underline">{t("Meldungen bearbeiten")}</Link> : null}
        {admin.data?.admin ? <Link to="/admin/zahlen" className="font-semibold text-ink underline">{t("Zahlen")}</Link> : null}
      </p>
      {error ? <Note>{error}</Note> : null}
      {authEnabled ? <Button type="button" tone="ghost" className="mb-6 w-full" disabled={signingOut} onClick={() => { setSigningOut(true); void signOut("/login").catch(() => setSigningOut(false)); }}>{signingOut ? t("Abmelden…") : t("Abmelden")}</Button> : null}
    </div>
  );
}

function PrefSwitch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (next: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(on);
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
        checked={value}
        disabled={busy}
        onChange={async (event) => {
          const next = event.target.checked;
          setValue(next);
          setBusy(true);
          try { await onChange(next); } catch { setValue(!next); } finally { setBusy(false); }
        }}
      />
    </label>
  );
}
