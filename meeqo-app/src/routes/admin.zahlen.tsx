import { createFileRoute, Link } from "@tanstack/react-router";
import { Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { adminFunnel, adminStats, setFlag } from "@/lib/meeqo/api";
import { useMe } from "@/components/shell";
import { formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/admin/zahlen")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Page,
});

function Page() {
  return (
    <Shell>
      <Stats />
    </Shell>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl leading-none">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const FLAG_LABELS: [string, string][] = [
  ["dating", "Dating"],
  ["business", "Business"],
  ["classifieds", "Kleinanzeigen"],
  ["communities", "Communities"],
];

function Switches() {
  const { profile, reload } = useMe();
  if (!profile) return null;
  async function flip(key: string, enabled: boolean) {
    await setFlag({ data: { key, enabled } });
    await reload();
  }
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-display text-2xl">Bereiche</h2>
      <p className="text-sm text-muted">Freunde und Aktivitäten sind immer an. Was hier aus ist, sieht niemand und kann niemand anlegen. Wirkt innerhalb von etwa 15 Sekunden.</p>
      {FLAG_LABELS.map(([key, label]) => {
        const on = profile.flags[key as keyof typeof profile.flags];
        return (
          <label key={key} className="flex min-h-11 items-center justify-between gap-3">
            <span className="font-semibold">{label}</span>
            <input type="checkbox" role="switch" className="h-6 w-11" checked={on} onChange={(event) => void flip(key, event.target.checked)} />
          </label>
        );
      })}
    </section>
  );
}

function FunnelCard() {
  const { data } = useLoad(() => adminFunnel(), []);
  if (!data) return null;
  const top = data.steps[0]?.count || 0;
  const pct = (value: number | null) => (value == null ? "–" : `${value} %`);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-display text-2xl">Weg der letzten 30 Tage</h2>
      <p className="text-sm text-muted">Konten der letzten 30 Tage und wie weit sie kamen.</p>
      {data.steps.map((step) => (
        <div key={step.key}>
          <div className="flex justify-between text-sm"><span>{step.key}</span><span className="font-semibold">{step.count}{top ? ` · ${Math.round((step.count / top) * 100)} %` : ""}</span></div>
          <div className="mt-1 h-2 rounded-full bg-sand-deep"><div className="h-2 rounded-full bg-accent" style={{ width: `${top ? (step.count / top) * 100 : 0}%` }} /></div>
        </div>
      ))}
      <h3 className="pt-2 text-base font-semibold">Trichter der letzten 7 Tage</h3>
      <p className="text-sm text-muted">Verschiedene Menschen je Schritt: Feed gesehen (eigene Zählung, eine Zeile pro Konto und Tag) → Anfrage → Zusage → Eingecheckt.</p>
      {data.week.map((step) => {
        const base = data.week[0]?.count || 0;
        return (
          <div key={step.key}>
            <div className="flex justify-between text-sm"><span>{step.key}</span><span className="font-semibold">{step.count}{base ? ` · ${Math.round((step.count / base) * 100)} %` : ""}</span></div>
            <div className="mt-1 h-2 rounded-full bg-sand-deep"><div className="h-2 rounded-full bg-green" style={{ width: `${base ? Math.min(100, (step.count / base) * 100) : 0}%` }} /></div>
          </div>
        );
      })}
      <div className="grid grid-cols-3 gap-2 pt-2 text-center">
        <Tile label="Heute aktiv" value={String(data.dau)} />
        <Tile label="7 Tage" value={String(data.wau)} />
        <Tile label="30 Tage" value={String(data.mau)} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <Tile label="Am nächsten Tag wieder" value={pct(data.returnD1)} hint="Konten bis 60 Tage alt" />
        <Tile label="Nach 7 Tagen wieder" value={pct(data.returnD7)} hint="Konten bis 60 Tage alt" />
      </div>
    </section>
  );
}

function Stats() {
  const { data, error, loading } = useLoad(() => adminStats(), []);
  if (error) return <Note>{error}</Note>;
  if (loading || !data) return <p className="text-sm text-muted">Wird geladen…</p>;
  const pct = (value: number | null) => (value == null ? "–" : `${value} %`);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-4xl leading-none">Zahlen</h1>
        <p className="mt-2 text-sm text-muted">Aus deiner eigenen Datenbank, ohne Tracking-Dienst. Beispiel-Profile zählen nicht mit.</p>
        <p className="mt-2 text-sm"><Link to="/admin/meldungen" className="underline">Meldungen</Link> · <Link to="/admin/pruefung" className="underline">Selfie-Prüfung</Link> · <Link to="/admin/orte" className="underline">Orte</Link></p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Konten" value={String(data.users)} hint={`${data.newUsers7} in 7 Tagen`} />
        <Tile label="Onboarding fertig" value={String(data.onboarded)} hint={data.users ? `${Math.round((data.onboarded / data.users) * 100)} % aller Konten` : undefined} />
        <Tile label="Neue Treffen, 7 Tage" value={String(data.activities7)} />
        <Tile label="Anfragen, 7 Tage" value={String(data.requests7)} />
        <Tile label="Nachrichten, 7 Tage" value={String(data.messages7)} />
        <Tile label="Beantwortet" value={pct(data.answeredRate)} hint="Anfragen der letzten 30 Tage, älter als 24 Std." />
        <Tile label="Zusagen" value={pct(data.acceptRate)} hint="von den beantworteten" />
        <Tile label="Unbeantwortet > 24 Std." value={String(data.unanswered24h)} hint="Das ist der Wert, der Leute vergrault" />
        <Tile label="Offene Meldungen" value={String(data.openReports)} />
        <Tile label="Fehler, 24 Std." value={String(data.errors24)} />
      </div>
      <FunnelCard />
      <Switches />
      {data.errorList.length ? (
        <section className="card space-y-2 p-4">
          <h2 className="font-display text-2xl">Letzte Fehler</h2>
          {data.errorList.map((item, index) => (
            <p key={index} className="text-sm">
              <span className="font-semibold">{item.path || "/"}</span> · {item.message}
              <span className="block text-xs text-muted">{formatWhen(item.createdAt)}</span>
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
