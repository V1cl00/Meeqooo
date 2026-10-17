import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { rateMeet, ratingTargets } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/rating/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Rate id={id} />
    </Shell>
  );
}

function Rate({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, error, loading } = useLoad(() => ratingTargets({ data: { id } }), [id]);
  const [person, setPerson] = useState("");
  const [fail, setFail] = useState("");

  async function answer(wantAgain: boolean) {
    const rateeId = person || data?.people[0]?.user_id;
    if (!rateeId) return;
    try {
      const result = await rateMeet({ data: { activityId: id, rateeId, punctual: 0, respectful: 0, matches: 0, wantAgain } });
      await navigate({ to: "/rating/complete", search: { mutual: result.mutual ? "1" : "0", activity: id } });
    } catch (err) {
      setFail(errText(err));
    }
  }

  if (loading) return <p className="text-sm text-muted">{t("Wird geladen…")}</p>;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;
  if (!data.checkedIn) return <Note>{t("Erst einchecken, dann bewerten. Das geht auf der Aktivität.")}</Note>;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Wieder treffen?")}</h1>
      <p className="text-sm text-muted">{t("Eine Frage zu {0}. Die Antwort bleibt unsichtbar, bis sie gegenseitig ist.", data.title)}</p>
      {data.people.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {data.people.map((item) => (
            <button key={item.user_id} type="button" onClick={() => setPerson(item.user_id)} className={`inline-flex h-11 items-center rounded-full border-2 px-3 text-sm font-semibold ${(person || data.people[0]?.user_id) === item.user_id ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>
              {item.display_name}
            </button>
          ))}
        </div>
      ) : <p className="text-sm">{t("Über {0}", data.people[0]?.display_name)}</p>}
      {fail ? <Note>{fail}</Note> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={data.people.length === 0} onClick={() => answer(true)}>{t("Ja, wieder")}</Button>
        <Button type="button" tone="ghost" disabled={data.people.length === 0} onClick={() => answer(false)}>{t("Nein")}</Button>
      </div>
    </div>
  );
}
