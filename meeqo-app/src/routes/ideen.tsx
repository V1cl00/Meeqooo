import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Empty, Note, Skeleton, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { addIdea, listIdeas, voteIdea } from "@/lib/meeqo/design";
import { errText } from "@/lib/meeqo/labels";
import { buzz } from "@/lib/meeqo/feel";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/ideen")({ component: Page });

function Page() {
  return (
    <Shell>
      <Wall />
    </Shell>
  );
}

/** Idea wall: write what you'd like to do, others say "Ich auch", anyone turns it into a meetup. */
function Wall() {
  const { data, error, loading, reload } = useLoad(() => listIdeas(), []);
  const [text, setText] = useState("");
  const [fail, setFail] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFail("");
    try {
      await addIdea({ data: { text } });
      setText("");
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  async function vote(id: string, on: boolean) {
    buzz();
    await voteIdea({ data: { id, on } }).catch((err) => setFail(errText(err)));
    reload();
  }

  if (loading && !data) return <Skeleton lines={4} />;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-4xl leading-none">{t("Ideenwand")}</h1>
        <p className="mt-2 text-sm text-muted">{data.city ? t("Was würdest du in {0} gern machen? Wer „Ich auch“ sagt, erfährt es, sobald jemand ein Treffen daraus macht.", data.city) : t("Stell zuerst deinen Ort ein.")}</p>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <TextInput value={text} onChange={(event) => setText(event.target.value)} maxLength={120} placeholder={t("Zum Beispiel: Sonntags Flohmarkt und danach Kaffee")} aria-label={t("Deine Idee")} />
        <Button type="submit" className="shrink-0" disabled={text.trim().length < 4}>{t("Posten")}</Button>
      </form>
      {fail ? <Note>{fail}</Note> : null}
      {data.ideas.length === 0 ? <Empty title={t("Noch keine Ideen")} body={t("Fang an. Eine Zeile reicht.")} art="plant" /> : null}
      <div className="space-y-2">
        {data.ideas.map((idea) => (
          <div key={idea.id} className="card space-y-2 p-4">
            <p className="font-semibold text-ink">{idea.text}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={idea.voted} onClick={() => void vote(idea.id, !idea.voted)} className={`inline-flex h-10 items-center rounded-control px-3 text-sm font-semibold ${idea.voted ? "bg-green text-ink" : "border border-line bg-card text-ink"}`}>
                {t("Ich auch")} · {idea.votes}
              </button>
              {idea.activityId ? (
                <Link to="/activity/$id" params={{ id: idea.activityId }} className="text-sm font-semibold text-friend underline">{t("Ist jetzt ein Treffen")}</Link>
              ) : (
                <Link to="/create" search={{ community: "", idea: idea.id, title: idea.text }} className="text-sm font-semibold text-accent-deep underline">{t("Daraus ein Treffen machen")}</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
