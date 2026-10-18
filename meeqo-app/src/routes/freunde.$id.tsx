import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Note, Skeleton, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { friendThread, sendFriendMessage } from "@/lib/meeqo/design";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/freunde/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Thread id={id} />
    </Shell>
  );
}

/** Private thread between two confirmed friends. Text only; refreshes every 10 seconds while open. */
function Thread({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => friendThread({ data: { id } }), [id]);
  const [body, setBody] = useState("");
  const [fail, setFail] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(reload, 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [data?.messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setFail("");
    try {
      await sendFriendMessage({ data: { id, body } });
      setBody("");
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  if (loading && !data) return <Skeleton lines={4} />;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 pb-24">
      <div className="flex items-center gap-3">
        {data.avatar ? <img src={data.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-deep font-display text-xl">{data.name.slice(0, 1)}</span>}
        <div>
          <h1 className="font-display text-3xl leading-none">{data.name}</h1>
          <p className="text-xs text-muted">{t("Privat. Nur ihr zwei seht das.")}</p>
        </div>
      </div>
      {data.messages.length === 0 ? <p className="text-sm text-muted">{t("Noch nichts geschrieben. Wie wär's mit einem Vorschlag fürs nächste Treffen?")}</p> : null}
      <div className="space-y-2">
        {data.messages.map((message) => (
          <div key={message.id} className={`max-w-[80%] rounded-control px-3 py-2 text-sm ${message.mine ? "ml-auto bg-accent text-onfill" : "bg-card text-ink"}`}>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
            <p className="mt-0.5 text-[10px] opacity-70">{formatWhen(message.at)}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      {fail ? <Note>{fail}</Note> : null}
      <form onSubmit={send} className="fixed inset-x-0 bottom-[5.4rem] z-20 px-3 md:bottom-6">
        <div className="mx-auto flex max-w-lg gap-2">
          <TextInput value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("Nachricht")} aria-label={t("Nachricht")} maxLength={1000} />
          <Button type="submit" className="shrink-0">{t("Senden")}</Button>
        </div>
      </form>
    </div>
  );
}
