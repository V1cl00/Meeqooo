import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Note, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { listMessages, sendMessage } from "@/lib/meeqo/api";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad, usePolling } from "@/lib/meeqo/use-load";

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
  const { data, error, loading, reload, refresh } = useLoad(() => listMessages({ data: { id } }), [id]);
  const [body, setBody] = useState("");
  const [fail, setFail] = useState("");
  const seen = useRef(0);
  usePolling(refresh);

  useEffect(() => {
    const count = data?.messages.length ?? 0;
    if (count > seen.current) window.scrollTo({ top: document.body.scrollHeight, behavior: seen.current === 0 ? "auto" : "smooth" });
    seen.current = count;
  }, [data?.messages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFail("");
    try {
      await sendMessage({ data: { id, body } });
      setBody("");
      refresh();
    } catch (err) {
      setFail(errText(err));
    }
  }

  if (loading) return <p className="text-sm text-muted">Wird geladen…</p>;
  if (error || !data) return <Note>{error || "Chat nicht da."}</Note>;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl leading-none">{data.title}</h1>
        {data.group ? <span className="mt-1 shrink-0 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold tracking-wide text-onaccent">GRUPPE</span> : null}
      </div>
      {data.group ? (
        <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1" aria-label="Teilnehmende">
          {data.people.map((person) => {
            const face = person.avatar ? (
              <img src={person.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-deep text-lg font-semibold">{person.name.slice(0, 1)}</span>
            );
            const label = (
              <>
                {face}
                <span className="mt-1 block truncate text-xs font-bold">{person.me ? "Du" : person.name.split(" ")[0]}</span>
                {person.isHost ? <span className="block text-[10px] font-semibold text-accent-deep">Gastgeber</span> : null}
              </>
            );
            return person.me ? (
              <Link key={person.id} to="/profile" className="w-16 shrink-0 text-center">{label}</Link>
            ) : (
              <Link key={person.id} to="/profile/$id" params={{ id: person.id }} className="w-16 shrink-0 text-center">{label}</Link>
            );
          })}
        </div>
      ) : null}
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
