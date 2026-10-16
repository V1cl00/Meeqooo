import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeRow, Button, IntentPill, Note, StatusLine } from "@/components/bits";
import { ShareSheet } from "@/components/share";
import { Shell } from "@/components/shell";
import { checkIn, getActivity, hideActivity, requestJoin, unhideActivity } from "@/lib/meeqo/api";
import { bookingLabel, errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/activity/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Detail id={id} />
    </Shell>
  );
}

function Detail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => getActivity({ data: { id } }), [id]);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const item = data?.activity;

  async function join() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      const result = await requestJoin({ data: { id: item.id } });
      setInfo(result.status === "accepted" ? "Du bist dabei. Der Chat ist offen." : "Anfrage ist raus. Der Ersteller entscheidet.");
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function arrive() {
    if (!item) return;
    setBusy(true);
    try {
      await checkIn({ data: { id: item.id } });
      setInfo("Check-in gespeichert. Bewertung ist frei.");
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function conceal() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      await hideActivity({ data: { id: item.id } });
      await navigate({ to: "/" });
    } catch (err) {
      setFail(errText(err));
      setBusy(false);
    }
  }

  async function reveal() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      await unhideActivity({ data: { id: item.id } });
      setInfo("Wieder im Feed.");
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Wird geladen…</p>;
  if (error || !item || !data) return <Note>{error || "Nicht gefunden."}</Note>;
  const oneToOne = item.intent === "date" && item.spots <= 2;
  const shareText = `MeeQo: ${item.title}\n${formatWhen(item.startsAt)}\n${item.placeName}, ${item.city}\nMit ${item.hostName}.\nLeute über eine Aktivität kennenlernen. Dating und Freundschaft bleiben getrennt.`;

  return (
    <article className="space-y-4">
      <div className="card overflow-hidden">
        {item.imageUrl ? <img src={item.imageUrl} alt="" className="aspect-[3/2] w-full object-cover" /> : <div className="aspect-[3/2] bg-sand-deep" />}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <IntentPill intent={item.intent} />
            <span className="rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">{bookingLabel(item.bookingMode)}</span>
            {item.publicPlace ? <span className="rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">Öffentlicher Ort</span> : null}
          </div>
          <h1 className="font-display text-4xl leading-none">{item.title}</h1>
          <p className="text-sm text-muted">{formatWhen(item.startsAt)} · {item.placeName}, {item.city}</p>
          <p className="text-sm">{item.description}</p>
          <p className="text-sm text-muted">{item.spotsLeft} von {item.spots} Plätzen frei · {item.category}</p>
          {item.cancelled ? <Note>Diese Aktivität ist abgesagt.</Note> : null}
        </div>
      </div>
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Gastgeber</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-sand-deep font-display text-xl">
            {item.hostAvatar ? <img src={item.hostAvatar} alt="" className="h-full w-full object-cover" /> : item.hostName.slice(0, 1)}
          </span>
          <div>
            {item.isHost ? (
              <Link to="/profile" className="font-semibold">{item.hostName}</Link>
            ) : (
              <Link to="/profile/$id" params={{ id: item.hostId }} className="font-semibold">{item.hostName}</Link>
            )}
            <p className="text-sm text-muted">{item.hostOrganizer ? "Veranstalter" : "Privates Treffen"}</p>
          </div>
        </div>
        <div className="mt-3">
          <BadgeRow badges={item.hostBadges} />
        </div>
      </div>
      <div className="card space-y-2 p-4">
        <h2 className="font-display text-2xl">{oneToOne ? "Vor dem Treffen" : "Weitergeben"}</h2>
        <p className="text-sm text-muted">
          {oneToOne
            ? "Erstes Date nur an diesem öffentlichen Ort. Die Vertrauensperson bekommt Zeit und Ort, wenn du den Text weiterleitest."
            : "Schick das Treffen an jemanden, der dazugehört."}
        </p>
        <Button type="button" tone="ghost" className="w-full" onClick={() => setShareOpen(true)}>Teilen</Button>
        {oneToOne ? (
          <a className="inline-flex h-12 items-center justify-center rounded-full border-2 border-ink bg-card px-4 text-sm font-semibold" href="tel:112">Notfall 112</a>
        ) : null}
      </div>
      <ShareSheet open={shareOpen} title={item.title} text={shareText} onClose={() => setShareOpen(false)} />
      <StatusLine error={fail} info={info} />
      {data.hidden ? <Note>Diese Aktivität ist für dich ausgeblendet. Feed, Suche und Vorschläge überspringen sie.</Note> : null}
      {data.mutual ? <Note>Ihr möchtet euch beide wiedersehen.</Note> : null}
      <div className="flex flex-wrap gap-2 pb-16">
        {!item.isHost && !data.hidden ? (
          <Button type="button" tone="ghost" disabled={busy} onClick={conceal}>Ausblenden</Button>
        ) : null}
        {!item.isHost && data.hidden ? (
          <Button type="button" tone="ghost" disabled={busy} onClick={reveal}>Wieder zeigen</Button>
        ) : null}
        {item.myStatus === "pending" ? <Note>Wartet auf Freigabe.</Note> : null}
        {(item.myStatus === "accepted" || item.isHost) && !data.checkedIn ? <Button type="button" tone="ghost" disabled={busy} onClick={arrive}>Check-in</Button> : null}
        {(item.myStatus === "accepted" || item.isHost) && data.checkedIn ? <Link to="/rating/$id" params={{ id: item.id }} className="inline-flex h-12 items-center rounded-full border border-line bg-card px-5 text-sm font-semibold">Bewerten</Link> : null}
      </div>
      <div className="fixed inset-x-0 bottom-[5.4rem] z-20 px-3 md:bottom-6">
        <div className="mx-auto flex max-w-lg gap-2">
          {!item.isHost && !item.cancelled && item.myStatus !== "accepted" && item.myStatus !== "pending" ? (
            <Button type="button" disabled={busy || item.spotsLeft < 1} className="h-12 flex-1" onClick={join}>
              {item.bookingMode === "instant" ? "Sofort dabei" : "Anfragen"}
            </Button>
          ) : null}
          {item.myStatus === "accepted" || item.isHost ? (
            <Link to="/chat/$id" params={{ id: item.id }} className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-onaccent">{item.spots > 2 ? "Gruppenchat" : "Chat"}</Link>
          ) : null}
          {oneToOne ? (
            <a className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-card px-4 text-sm font-semibold" href="tel:112">112</a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
