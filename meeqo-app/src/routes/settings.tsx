import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, face, Field, Note, TextArea } from "@/components/bits";
import { Shell, useMe } from "@/components/shell";
import { adminStatus, deleteAccount, designTheme, listBlocked, listHidden, pushKey, resetTheme, savePush, setLocation, setNotify, setRadius, unblockUser, unhideActivity } from "@/lib/meeqo/api";
import { signOut } from "@/lib/auth/client";
import { errText, formatWhen, RADIUS_OPTIONS } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

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
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const hidden = useLoad(() => listHidden(), []);
  const blocked = useLoad(() => listBlocked(), []);
  const admin = useLoad(() => adminStatus(), []);
  const [confirm, setConfirm] = useState("");
  if (!profile) return null;

  async function locate() {
    setError("");
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const result = await setLocation({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          await reload();
          setInfo(result.city ? `Standort: ${result.city}` : "Standort gespeichert.");
        } catch (err) {
          setError(errText(err));
        }
      },
      () => setError("Standort nicht freigegeben."),
    );
  }

  async function push() {
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
    setInfo(enabled ? (background ? "Mitteilungen an, auch wenn MeeQo zu ist." : "Mitteilungen an, solange MeeQo offen ist.") : "Mitteilungen bleiben aus.");
    if (!enabled) setError("Der Browser hat nicht zugestimmt.");
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
      setInfo(result.source === "ai" ? `„${result.theme.name}“ ist an.` : `„${result.theme.name}“ ist an. Die KI war gerade nicht da, die Farben kommen aus deinen Worten.`);
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">Einstellungen</h1>
      <form onSubmit={design} className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">Dein Design</h2>
        <p className="text-sm text-muted">Beschreib in einem Satz, wie MeeQo aussehen soll. Die KI setzt Farben, Schrift und Ecken. Der Text bleibt lesbar, nur für dich.</p>
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
        <Field label="Wie soll es sich anfühlen?">
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Zum Beispiel: ruhig, meerblau, weiche Ecken" maxLength={240} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || note.trim().length < 2}>{pending ? "Wird gestaltet…" : "Mit KI gestalten"}</Button>
          {profile.theme ? (
            <Button
              type="button"
              tone="ghost"
              onClick={async () => {
                await resetTheme();
                await reload();
                setInfo("Wieder das MeeQo-Design.");
              }}
            >
              Zurück zu MeeQo
            </Button>
          ) : null}
        </div>
      </form>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">Radius</h2>
        <p className="text-sm text-muted">Gilt für Feed und Suche. Gerade {profile.radiusKm} km um {profile.city || "deinen Ort"}.</p>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={async () => {
                await setRadius({ data: { radiusKm: item } });
                await reload();
              }}
              className={`inline-flex h-11 items-center rounded-full border px-3 text-sm font-semibold ${profile.radiusKm === item ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}
            >
              {item} km
            </button>
          ))}
        </div>
        <Button type="button" tone="ghost" onClick={locate}>Standort vom Handy</Button>
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">Mitteilungen</h2>
        <p className="text-sm text-muted">Anfragen, Zusagen und Erinnerungen 36 Stunden vorher. Mitteilungen kommen auch bei geschlossener App, wenn dein Browser und der Server es können. Sonst nur, solange MeeQo offen ist.</p>
        <Button type="button" onClick={push}>{profile.notifyPush ? "Mitteilungen sind an" : "Mitteilungen erlauben"}</Button>
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">Ausgeblendet</h2>
        <p className="text-sm text-muted">Diese Aktivitäten siehst du nicht im Feed, in der Suche, in Communities und bei Vorschlägen. Zusagen und eigene Termine bleiben trotzdem unter Meine Aktivitäten.</p>
        {hidden.loading ? <p className="text-sm text-muted">Wird geladen…</p> : null}
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
                  setInfo("Wieder sichtbar.");
                  setError("");
                } catch (err) {
                  setError(errText(err));
                }
              }}
            >
              Wieder zeigen
            </button>
          </div>
        ))}
        {!hidden.loading && (hidden.data ?? []).length === 0 ? <p className="text-sm text-muted">Nichts ausgeblendet.</p> : null}
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-2xl">Blockiert</h2>
        <p className="text-sm text-muted">Blockierte Personen sehen dich nicht, können dich nicht anfragen und dir nicht schreiben. Das gilt für beide Seiten.</p>
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
                  setInfo("Nicht mehr blockiert.");
                } catch (err) {
                  setError(errText(err));
                }
              }}
            >
              Entblocken
            </button>
          </div>
        ))}
        {!blocked.loading && (blocked.data ?? []).length === 0 ? <p className="text-sm text-muted">Niemand blockiert.</p> : null}
      </div>
      <div className="card space-y-3 border-2 !border-ink p-4">
        <h2 className="font-display text-2xl">Konto löschen</h2>
        <p className="text-sm text-muted">Löscht dein Profil, deine Treffen, Anzeigen, Chats, Bewertungen und Fotos. Das lässt sich nicht rückgängig machen.</p>
        <Field label="Tipp LÖSCHEN zur Bestätigung">
          <input value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-12 w-full rounded-2xl border border-line bg-sand px-4 text-base outline-none focus:border-accent" autoComplete="off" />
        </Field>
        <Button type="button" tone="ink" disabled={confirm !== "LÖSCHEN"} onClick={erase}>Konto endgültig löschen</Button>
      </div>
      <p className="flex flex-wrap gap-4 pb-4 text-sm text-muted">
        <Link to="/datenschutz" className="underline">Datenschutz</Link>
        <Link to="/impressum" className="underline">Impressum</Link>
        <Link to="/support" className="underline">Hilfe</Link>
        {admin.data?.admin ? <Link to="/admin/meldungen" className="font-semibold text-ink underline">Meldungen bearbeiten</Link> : null}
      </p>
      {error ? <Note>{error}</Note> : null}
      {info ? <p className="text-sm text-friend">{info}</p> : null}
    </div>
  );
}
