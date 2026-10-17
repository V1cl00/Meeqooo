import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Note, Skeleton, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { listMessages, sendMessage } from "@/lib/meeqo/api";
import { PollCard, PollForm } from "@/components/poll";
import { announce } from "@/lib/meeqo/api";
import { ARRIVAL_REPLIES, errText, formatWhen } from "@/lib/meeqo/labels";
import { buzz } from "@/lib/meeqo/feel";
import type { ChatMessage } from "@/lib/meeqo/types";
import { useLiveChat, useLoad, usePolling } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

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
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  useLiveChat(id, "activity", refresh);
  usePolling(refresh, 30);

  useEffect(() => {
    const count = (data?.messages.length ?? 0) + pending.length;
    if (count > seen.current) window.scrollTo({ top: document.body.scrollHeight, behavior: seen.current === 0 ? "auto" : "smooth" });
    seen.current = count;
  }, [data?.messages.length, pending.length]);

  useEffect(() => {
    if (!data) return;
    // A message shows at once and is dropped from the waiting list as soon as the server returns it.
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
      await sendMessage({ data: { id, body: clean } });
      buzz(8);
      refresh();
    } catch (err) {
      setPending((list) => list.filter((item) => item.id !== temp.id));
      if (fromInput) setBody(clean);
      setFail(errText(err));
    }
  }

  async function sendAnnouncement() {
    const text = body.trim();
    if (!text) return;
    setFail("");
    try {
      await announce({ data: { id, body: text } });
      setBody("");
      setAnnounceOpen(false);
      buzz(8);
      refresh();
    } catch (err) {
      setFail(errText(err));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(body);
  }

  if (loading) return <Skeleton lines={5} />;
  if (error || !data) return <Note>{error || t("Chat nicht da.")}</Note>;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl leading-none">{data.title}</h1>
        {data.group ? <span className="mt-1 shrink-0 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold tracking-wide text-onaccent">{t("GRUPPE")}</span> : null}
      </div>
      {data.group ? (
        <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1" aria-label={t("Teilnehmende")}>
          {data.people.map((person) => {
            const face = person.avatar ? (
              <img src={person.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-deep text-lg font-semibold">{person.name.slice(0, 1)}</span>
            );
            const label = (
              <>
                {face}
                <span className="mt-1 block truncate text-xs font-bold">{person.me ? t("Du") : person.name.split(" ")[0]}</span>
                {person.isHost ? <span className="block text-[10px] font-semibold text-accent-deep">{t("Gastgeber")}</span> : null}
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
        {[...data.messages, ...pending, ...data.polls.map((poll) => ({ id: `poll-${poll.id}`, createdAt: poll.createdAt, poll }))].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((message) => "poll" in message ? (
          <PollCard key={message.id} poll={message.poll} onChanged={refresh} />
        ) : (
          <div key={message.id} className={`flex max-w-[85%] items-end gap-2 ${message.mine ? "ml-auto" : ""} ${message.id.startsWith("tmp-") ? "opacity-70" : ""}`}>
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
      {pollOpen ? (
        <div className="mt-4">
          <PollForm activityId={id} onDone={() => { setPollOpen(false); refresh(); }} />
        </div>
      ) : null}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {data.dayOf
          ? ARRIVAL_REPLIES.map((reply) => (
              <button key={reply} type="button" onClick={() => send(t(reply))} className="inline-flex h-11 shrink-0 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">{t(reply)}</button>
            ))
          : null}
        {data.people.find((person) => person.me)?.isHost ? (
          <button type="button" onClick={() => setAnnounceOpen((value) => !value)} className="inline-flex h-11 shrink-0 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">{t("Ansage an alle")}</button>
        ) : null}
        <button type="button" onClick={() => setPollOpen((value) => !value)} className="inline-flex h-11 shrink-0 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">{t("Termin abstimmen")}</button>
      </div>
      {fail ? <Note>{fail}</Note> : null}
      {announceOpen ? <p className="mt-3 text-sm text-muted">{t("Die Ansage geht als Mitteilung an alle, die dabei sind. Schreib sie unten und tippe auf „Ansage senden“.")}</p> : null}
      <form onSubmit={(event) => { if (announceOpen) { event.preventDefault(); void sendAnnouncement(); } else submit(event); }} className="mt-3 flex gap-2">
        <TextInput value={body} onChange={(event) => setBody(event.target.value)} placeholder={announceOpen ? "Ansage an alle" : "Nachricht"} />
        <Button type="submit">{announceOpen ? t("Ansage senden") : t("Senden")}</Button>
      </form>
    </div>
  );
}
