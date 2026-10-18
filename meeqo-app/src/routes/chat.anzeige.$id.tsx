import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Note, Skeleton, TextInput } from "@/components/bits";
import { SafetyMenu } from "@/components/safety";
import { Shell } from "@/components/shell";
import { listAdMessages, sendAdMessage } from "@/lib/meeqo/api";
import { Attachment } from "@/components/attachment";
import { readAttachment } from "@/lib/meeqo/attach";
import { useVoice } from "@/lib/meeqo/voice";
import { errText, formatWhen, HANDOVER_SPOTS } from "@/lib/meeqo/labels";
import { buzz } from "@/lib/meeqo/feel";
import type { ChatMessage } from "@/lib/meeqo/types";
import { useLiveChat, useLoad, usePolling } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

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
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const voice = useVoice((text) => setBody((current) => (current ? `${current} ${text}` : text)));
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

  async function sendFile(file: File) {
    setFail("");
    setSending(true);
    try {
      const attachment = await readAttachment(file);
      await sendAdMessage({ data: { id, body: "", attachment } });
      buzz(8);
      refresh();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setSending(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(body);
  }

  if (loading) return <Skeleton lines={5} />;
  if (error || !data) return <Note>{error || t("Chat nicht da.")}</Note>;
  const handover = data.category !== "Mitfahrgelegenheit";

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl leading-none">{data.title}</h1>
        <span className="mt-1 shrink-0 rounded-full border border-ink/40 px-2.5 py-1 text-[10px] font-bold tracking-wide">{t("ANZEIGE")}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {data.seller ? t("{0} interessiert sich für deine Anzeige.", data.peerName) : t("Du schreibst mit {0}.", data.peerName)}
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
              {message.attachment && message.body.startsWith("📎 ") ? null : <p>{message.body}</p>}
              {message.attachment ? <Attachment id={message.id} file={message.attachment} mine={message.mine} ad /> : null}
              <p className={`mt-1 text-[11px] ${message.mine ? "text-onaccent/80" : "text-muted"}`}>{formatWhen(message.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      {handover ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted">{t("Übergabe nur an einem öffentlichen Ort vorschlagen")}</p>
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {HANDOVER_SPOTS.map((spot) => (
              <button
                key={spot}
                type="button"
                onClick={() => send(t("Übergabe öffentlich, zum Beispiel am {0} in {1}. Passt dir das?", t(spot), data.city))}
                className="inline-flex h-10 shrink-0 items-center rounded-control border border-line bg-card px-4 text-sm font-semibold"
              >
                {t(spot)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {fail || voice.problem ? <Note>{t(fail || voice.problem)}</Note> : null}
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,application/pdf,image/*" className="sr-only" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendFile(file); }} />
        <button type="button" aria-label={t("Datei senden")} disabled={sending} onClick={() => fileInput.current?.click()} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card disabled:opacity-50">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l9.2-9.2a3.7 3.7 0 015.2 5.2l-9.2 9.2a1.8 1.8 0 01-2.6-2.6l8.3-8.3" /></svg>
        </button>
        <TextInput value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("Nachricht")} />
        {voice.supported ? (
          <button type="button" aria-label={voice.listening ? t("Aufnahme beenden") : t("Sprechen")} aria-pressed={voice.listening} onClick={voice.toggle} className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${voice.listening ? "animate-pulse border-accent bg-accent text-onfill" : "border-line bg-card"}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
          </button>
        ) : null}
        <Button type="submit">{t("Senden")}</Button>
      </form>
      <div className="mt-4">
        <SafetyMenu kind="ad" targetId={id} personId={data.peerId} personName={data.peerName.split(" ")[0]} onBlocked={reload} />
      </div>
    </div>
  );
}
