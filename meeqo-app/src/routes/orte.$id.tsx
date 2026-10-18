import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { Note, Skeleton } from "@/components/bits";
import { Shell } from "@/components/shell";
import { getVenue } from "@/lib/meeqo/design";
import { formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/orte/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Venue id={id} />
    </Shell>
  );
}

/** A place page from public information. Not a partner page: nobody at the venue was asked or contacted. */
function Venue({ id }: { id: string }) {
  const { data, error, loading } = useLoad(() => getVenue({ data: { id } }), [id]);
  if (loading && !data) return <Skeleton lines={4} />;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;
  const { venue, meetups } = data;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <section className="rounded-card bg-ink p-5 text-onaccent">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{venue.kind}</p>
        <h1 className="font-display text-4xl leading-none">{venue.name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm opacity-80"><MapPin className="h-4 w-4" aria-hidden="true" />{venue.address}</p>
      </section>
      {venue.idea ? <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Idee für ein Treffen")}</p><p className="mt-1 font-semibold">{venue.idea}</p></div> : null}
      <section className="space-y-2">
        <h2 className="font-display text-2xl">{t("Treffen hier")}</h2>
        {meetups.length === 0 ? <p className="text-sm text-muted">{t("Gerade nichts geplant.")}</p> : null}
        {meetups.map((item) => (
          <Link key={item.id} to="/activity/$id" params={{ id: item.id }} className="card block p-3">
            <span className="block font-semibold">{item.title}</span>
            <span className="block text-sm text-muted">{formatWhen(item.startsAt)}</span>
          </Link>
        ))}
        <Link to="/create" search={{ community: "", venue: venue.id }} className="inline-flex h-12 w-full items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill">{t("Hier ein Treffen anlegen")}</Link>
      </section>
      <p className="text-xs text-muted">{t("Öffentliche Angaben. Der Ort ist kein Partner von MeeQo und veranstaltet nichts selbst.")}</p>
      {venue.website ? <a href={venue.website} target="_blank" rel="noreferrer noopener" className="text-sm text-muted underline">{t("Website des Ortes")}</a> : null}
    </div>
  );
}
