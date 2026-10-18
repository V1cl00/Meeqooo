import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivityCard } from "@/components/bits";
import { Shell } from "@/components/shell";
import { getActivity, getFeed } from "@/lib/meeqo/api";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/rating/complete")({
  validateSearch: (search: Record<string, unknown>) => ({
    mutual: search.mutual === "1" ? "1" : "0",
    activity: typeof search.activity === "string" ? search.activity : "",
  }),
  component: Page,
});

function Page() {
  const { mutual, activity } = Route.useSearch();
  const current = useLoad(() => (activity ? getActivity({ data: { id: activity } }) : Promise.resolve(null)), [activity]);
  const category = current.data?.activity.category ?? "";
  const next = useLoad(() => getFeed({ data: { category } }), [category]);
  const ideas = (next.data?.items ?? []).filter((item) => item.id !== activity).slice(0, 2);
  return (
    <Shell>
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="font-display text-4xl leading-none">{mutual === "1" ? t("Ihr wollt euch wiedersehen.") : t("Gespeichert.")}</h1>
        <p className="text-sm text-muted">
          {mutual === "1"
            ? t("Beide haben ja gesagt. Deshalb siehst du es. Als Nächstes passt etwas in derselben Richtung.")
            : t("Wenn die andere Person auch wieder möchte, sagen wir Bescheid. Vorher nicht.")}
        </p>
        {ideas.map((item) => <ActivityCard key={item.id} item={item} />)}
        <div className="flex flex-wrap gap-2">
          <Link to="/create" search={{ community: "" }} className="inline-flex h-12 items-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill">{t("Nächste Woche selbst anlegen")}</Link>
          <Link to="/" className="inline-flex h-12 items-center rounded-control border-2 border-line bg-card px-5 text-sm font-semibold">{t("Zum Feed")}</Link>
        </div>
      </div>
    </Shell>
  );
}