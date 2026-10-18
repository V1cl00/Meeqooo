import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivityCard, Button, face, Note } from "@/components/bits";
import { PostBoard } from "@/components/posts";
import { Shell } from "@/components/shell";
import { getCommunity, hideActivity, joinCommunity, unhideActivity } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import type { ActivityCard as Card } from "@/lib/meeqo/types";
import { useLoad } from "@/lib/meeqo/use-load";
import { useState } from "react";
import { t } from "@/lib/meeqo/i18n";

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
  const [fail, setFail] = useState("");
  const [gone, setGone] = useState<{ id: string; title: string } | null>(null);

  async function join() {
    try {
      await joinCommunity({ data: { id } });
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  async function hide(item: Card) {
    setFail("");
    try {
      await hideActivity({ data: { id: item.id } });
      setGone({ id: item.id, title: item.title });
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  async function undoHide() {
    if (!gone) return;
    try {
      await unhideActivity({ data: { id: gone.id } });
      setGone(null);
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  if (loading) return <p className="text-sm text-muted">{t("Wird geladen…")}</p>;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{data.city} · {data.topic}</p>
      <h1 className="font-display text-4xl leading-none">{data.name}</h1>
      <p className="text-sm">{data.description}</p>
      {fail ? <Note>{fail}</Note> : null}
      {gone ? (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm">{t("„{0}“ bleibt ausgeblendet.", gone.title)}</p>
          <button type="button" className={face} onClick={undoHide}>{t("Rückgängig")}</button>
        </div>
      ) : null}
      {data.joined ? (
        <>
          <PostBoard communityId={id} canPost />
          <Link to="/create" search={{ community: id }} className="inline-flex h-12 items-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill">{t("Aktivität vorschlagen")}</Link>
          <div className="grid gap-4 md:grid-cols-2">
            {data.activities.map((item) => <ActivityCard key={item.id} item={item} onHide={() => hide(item)} />)}
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
