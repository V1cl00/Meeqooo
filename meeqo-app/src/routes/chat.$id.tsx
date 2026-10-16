import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Note, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { listMessages, sendMessage } from "@/lib/meeqo/api";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/chat/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Thread id={id} />
    </Shell>
  );
}

function Thread({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => listMessages({ data: { id } }), [id]);
  const [body, setBody] = useState("");
  const [fail, setFail] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFail("");
    try {
      await sendMessage({ data: { id, body } });
      setBody("");
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  if (loading) return <p className="text-sm text-muted">Wird geladen…</p>;
  if (error || !data) return <Note>{error || "Chat nicht da."}</Note>;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col">
      <h1 className="font-display text-3xl leading-none">{data.title}</h1>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        {data.messages.map((message) => (
          <div key={message.id} className={`flex max-w-[85%] items-end gap-2 ${message.mine ? "ml-auto" : ""}`}>
            {message.mine ? null : message.senderAvatar ? (
              <img src={message.senderAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand-deep text-xs font-semibold">{message.senderName.slice(0, 1)}</span>
            )}
            <div className={`rounded-3xl px-4 py-2 text-sm ${message.mine ? "bg-ink text-onaccent" : "bg-card"}`}>
              {message.mine ? null : <p className="text-xs text-muted">{message.senderName}</p>}
              <p>{message.body}</p>
              <p className={`mt-1 text-[11px] ${message.mine ? "text-onaccent/80" : "text-muted"}`}>{formatWhen(message.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      {fail ? <Note>{fail}</Note> : null}
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <TextInput value={body} onChange={(event) => setBody(event.target.value)} placeholder="Nachricht" />
        <Button type="submit">Senden</Button>
      </form>
    </div>
  );
}
