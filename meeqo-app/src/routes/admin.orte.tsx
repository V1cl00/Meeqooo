import { createFileRoute, Link } from "@tanstack/react-router";
import { Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { adminStatus } from "@/lib/meeqo/api";
import { listVenues } from "@/lib/meeqo/round3";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/admin/orte")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Page,
});

function Page() {
  return (
    <Shell>
      <Venues />
    </Shell>
  );
}

function Venues() {
  const admin = useLoad(() => adminStatus(), []);
  const { data, error } = useLoad(() => listVenues(), []);
  if (admin.data && !admin.data.admin) return <Note>Nicht gefunden.</Note>;
  if (error) return <Note>{error}</Note>;
  const kinds = [...new Set((data ?? []).map((item) => item.kind))];
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-4xl leading-none">Orte als Vorlagen</h1>
        <p className="mt-2 text-sm text-muted">Öffentliche Infos aus der Recherche (Karlsruhe). Keine Partner, niemand wurde kontaktiert. „Als Treffen anlegen“ füllt nur das Formular vor; du legst das Treffen selbst als Gastgeber an.</p>
        <p className="mt-2 text-sm"><Link to="/admin/zahlen" className="underline">Zahlen</Link> · <Link to="/admin/pruefung" className="underline">Selfie-Prüfung</Link></p>
      </div>
      {kinds.map((kind) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{kind}</h2>
          {(data ?? []).filter((item) => item.kind === kind).map((item) => (
            <div key={item.id} className="card space-y-1 p-4">
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-muted">{item.address}</p>
              {item.idea ? <p className="text-sm">Idee: {item.idea}</p> : null}
              <div className="flex flex-wrap gap-3 pt-1 text-sm">
                <Link to="/create" search={{ community: "", venue: item.id }} className="font-semibold text-accent-deep underline">Als Treffen anlegen</Link>
                <Link to="/orte/$id" params={{ id: item.id }} className="text-muted underline">Ortsseite</Link>
                {item.website ? <a href={item.website} target="_blank" rel="noreferrer noopener" className="text-muted underline">Website</a> : null}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
