import { createFileRoute, Link } from "@tanstack/react-router";
import { Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { adminStats } from "@/lib/meeqo/api";
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
        <p className="mt-2 text-sm"><Link to="/admin/meldungen" className="underline">Meldungen</Link></p>
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
