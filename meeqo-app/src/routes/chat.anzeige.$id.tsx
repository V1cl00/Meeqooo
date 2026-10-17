import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Note, Skeleton, TextInput } from "@/components/bits";
import { SafetyMenu } from "@/components/safety";
import { Shell } from "@/components/shell";
import { listAdMessages, sendAdMessage } from "@/lib/meeqo/api";
import { errText, formatWhen, HANDOVER_SPOTS } from "@/lib/meeqo/labels";
import { buzz } from "@/lib/meeqo/feel";
import type { ChatMessage } from "@/lib/meeqo/types";
import { useLiveChat, useLoad, usePolling } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/chat/anzeige/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Thread id={id} />
    </Shell>
  );
}

function Thread({ id }: { id: string }) {
  const { data, error, loading, reload, refresh } = useLoad(() => listAdMessages({ data: { id } }), [id]);
  const [body, setBody] = useState("");
  const [fail, setFail] = useState("");
  const seen = useRef(0);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  useLiveChat(id, "ad", refresh);
  usePolling(refresh, 30);

  useEffect(() => {
    const count = (data?.messages.length ?? 0) + pending.length;
    if (count > seen.current) window.scrollTo({ top: document.body.scrollHeight, behavior: seen.current === 0 ? "auto" : "smooth" });
    seen.current = count;
  }, [data?.messages.length, pending.length]);

  useEffect(() => {
    if (!data) return;
    setPending((list) => list.filter((temp) => !data.messages.some((item) => item.mine && item.body === temp.body && Math.abs(new Date(item.createdAt).getTime() - new Date(temp.createdAt).getTime()) < 120_000)));
  }, [data]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setFail("");
    const fromInput = clean === body.trim();
    const temp: ChatMessage = { id: `tmp-${Date.now()}`, senderId: "", senderName: "Du", senderAvatar: "", body: clean, createdAt: new Date().toISOString(), mine: true };
    setPending((list) => [...list, temp]);
    if (fromInput) setBody("");
    try {
      await sendAdMessage({ data: { id, body: clean } });
      buzz(8);
      refresh();
    } catch (err) {
      setPending((list) => list.filter((item) => item.id !== temp.id));
      if (fromInput) setBody(clean);
      setFail(errText(err));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(body);
  }

  if (loading) return <Skeleton lines={5} />;
  if (error || !data) return <Note>{error || "Chat nicht da."}</Note>;
  const handover = data.category !== "Mitfahrgelegenheit";

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl leading-none">{data.title}</h1>
        <span className="mt-1 shrink-0 rounded-full border border-ink/40 px-2.5 py-1 text-[10px] font-bold tracking-wide">ANZEIGE</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {data.seller ? `${data.peerName} interessiert sich für deine Anzeige.` : `Du schreibst mit ${data.peerName}.`}
        {data.price ? ` · ${data.price}` : ""} · {data.city}
      </p>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        {[...data.messages, ...pending].map((message) => (
          <div key={message.id} className={`flex max-w-[85%] items-end gap-2 ${message.mine ? "ml-auto" : ""} ${message.id.startsWith("tmp-") ? "opacity-70" : ""}`}>
            {message.mine ? null : message.senderAvatar ? (
              <img src={message.senderAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand-deep text-xs font-semibold">{message.senderName.slice(0, 1)}</span>
            )}
            <div className={`rounded-3xl px-4 py-2 text-sm ${message.mine ? "bg-ink text-onaccent" : "bg-card"}`}>
              <p>{message.body}</p>
              <p className={`mt-1 text-[11px] ${message.mine ? "text-onaccent/80" : "text-muted"}`}>{formatWhen(message.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      {handover ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted">Übergabe nur an einem öffentlichen Ort vorschlagen</p>
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {HANDOVER_SPOTS.map((spot) => (
              <button
                key={spot}
                type="button"
                onClick={() => send(`Übergabe öffentlich, zum Beispiel am ${spot} in ${data.city}. Passt dir das?`)}
                className="inline-flex h-10 shrink-0 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
              >
                {spot}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {fail ? <Note>{fail}</Note> : null}
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <TextInput value={body} onChange={(event) => setBody(event.target.value)} placeholder="Nachricht" />
        <Button type="submit">Senden</Button>
      </form>
      <div className="mt-4">
        <SafetyMenu kind="ad" targetId={id} personId={data.peerId} personName={data.peerName.split(" ")[0]} onBlocked={reload} />
      </div>
    </div>
  );
}
