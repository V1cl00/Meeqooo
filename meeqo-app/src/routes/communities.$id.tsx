import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivityCard, Button, face, Note } from "@/components/bits";
import { PostBoard } from "@/components/posts";
import { Shell } from "@/components/shell";
import { getCommunity, joinCommunity } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import type { ActivityCard as Card } from "@/lib/meeqo/types";
import { useLoad } from "@/lib/meeqo/use-load";
import { useState } from "react";
import { t } from "@/lib/meeqo/i18n";
import { useHide } from "@/components/hide-sheet";

export const Route = createFileRoute("/communities/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Community id={id} />
    </Shell>
  );
}

function Community({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => getCommunity({ data: { id } }), [id]);
  const hider = useHide(() => reload());
  const [fail, setFail] = useState("");

  async function join() {
    try {
      await joinCommunity({ data: { id } });
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }


  if (loading) return <p className="text-sm text-muted">{t("Wird geladen…")}</p>;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;

  return (
    <div className="space-y-4">
      {hider.ui}
      <p className="text-sm text-muted">{data.city} · {data.topic}</p>
      <h1 className="font-display text-4xl leading-none">{data.name}</h1>
      <p className="text-sm">{data.description}</p>
      {fail ? <Note>{fail}</Note> : null}
      {data.joined ? (
        <>
          <PostBoard communityId={id} canPost />
          <Link to="/create" search={{ community: id }} className="inline-flex h-12 items-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill">{t("Aktivität vorschlagen")}</Link>
          <div className="grid gap-4 md:grid-cols-2">
            {data.activities.map((item) => <ActivityCard key={item.id} item={item} onHide={() => hider.ask(item)} />)}
            {data.activities.length === 0 ? <p className="text-sm text-muted">{t("Noch keine passende Aktivität. Schlag die erste vor.")}</p> : null}
          </div>
        </>
      ) : (
        <>
          <Button type="button" onClick={join}>{t("Beitreten")}</Button>
          <Note>{t("Beiträge und Aktivitäten siehst du als Mitglied. Date und Freundschaft bleiben auch hier getrennt.")}</Note>
        </>
      )}
    </div>
  );
}
