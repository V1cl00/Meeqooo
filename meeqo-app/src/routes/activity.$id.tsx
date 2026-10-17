import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeRow, Button, IntentPill, Note, SparteStrip, StatusLine } from "@/components/bits";
import { SafetyMenu } from "@/components/safety";
import { ShareSheet } from "@/components/share";
import { Shell } from "@/components/shell";
import { checkIn, confirmAttendance, createInvite, createSafetyLink, getActivity, hideActivity, repeatActivity, requestJoin, unhideActivity } from "@/lib/meeqo/api";
import { bookingLabel, countdownLabel, errText, formatWhen, MOODS, replyLabel, sparteOf } from "@/lib/meeqo/labels";
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
  const [mood, setMood] = useState<string>(MOODS[0]);
  const [trust, setTrust] = useState<{ title: string; text: string } | null>(null);
  const [weeks, setWeeks] = useState(1);
  const item = data?.activity;

  async function join() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      const result = await requestJoin({ data: { id: item.id, mood } });
      const reply = data?.hostReplyHours != null ? ` ${item.hostName.split(" ")[0]} antwortet meist in ${replyLabel(data.hostReplyHours)}.` : "";
      setInfo(result.status === "accepted" ? "Du bist dabei. Der Chat ist offen." : `Anfrage ist raus.${reply} Du bekommst eine Mitteilung, sobald es eine Antwort gibt.`);
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function again() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      const result = await repeatActivity({ data: { id: item.id, weeks } });
      await navigate({ to: "/activity/$id", params: { id: result.id } });
    } catch (err) {
      setFail(errText(err));
      setBusy(false);
    }
  }

  async function trustLink() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      const result = await createSafetyLink({ data: { id: item.id } });
      const url = `${window.location.origin}${result.path}`;
      setTrust({ title: "Mein Treffen", text: `Ich gehe zu „${item.title}“ (${formatWhen(item.startsAt)}, ${item.placeName}, ${item.city}). Hier siehst du, ob ich eingecheckt bin: ${url}` });
      setShareOpen(true);
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      const result = await createInvite({ data: { id: item.id } });
      const url = `${window.location.origin}${result.path}`;
      setTrust({ title: item.title, text: `Komm mit zu „${item.title}“ (${formatWhen(item.startsAt)}, ${item.placeName}, ${item.city}). Hier siehst du das Treffen und kannst anfragen: ${url}` });
      setShareOpen(true);
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function attend(coming: boolean) {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      const result = await confirmAttendance({ data: { id: item.id, coming } });
      setInfo(result.status === "confirmed" ? "Gut, bis dann." : "Schade. Dein Platz ist wieder frei.");
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
  const sparte = sparteOf(item.area, item.category);
  const business = sparte.kind === "business";
  const oneToOne = !business && item.intent === "date" && item.spots <= 2;
  const shareText = `MeeQo: ${item.title}\n${formatWhen(item.startsAt)}\n${item.placeName}, ${item.city}\nMit ${item.hostName}.\nLeute über eine Aktivität kennenlernen. Dating und Freundschaft bleiben getrennt.`;

  return (
    <article className="space-y-4">
      {data.needsConfirm ? (
        <div className="card space-y-3 border-2 !border-accent p-4">
          <h2 className="font-display text-2xl leading-tight">{countdownLabel(item.startsAt) === "morgen" ? "Bist du morgen dabei?" : "Bist du dabei?"}</h2>
          <p className="text-sm text-muted">Sag kurz Bescheid. Wenn du nicht kannst, wird dein Platz für andere frei.</p>
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={busy} onClick={() => attend(true)}>Ja, ich komme</Button>
            <Button type="button" tone="ghost" className="flex-1" disabled={busy} onClick={() => attend(false)}>Doch nicht</Button>
          </div>
        </div>
      ) : null}
      <div className={`card overflow-hidden ${business ? "!border-2 !border-ink" : sparte.kind === "event" ? "!border-2 !border-accent-deep" : ""}`}>
        <SparteStrip kind={sparte.kind} sub={sparte.sub} />
        {item.imageUrl ? <img src={item.imageUrl} alt="" className="aspect-[3/2] w-full object-cover" /> : <div className="aspect-[3/2] bg-sand-deep" />}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {business ? null : <IntentPill intent={item.intent} />}
            <span className="rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">{bookingLabel(item.bookingMode)}</span>
            {item.publicPlace ? <span className="rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">Öffentlicher Ort</span> : null}
          </div>
          <h1 className="font-display text-4xl leading-none">{item.title}</h1>
          <p className="text-sm text-muted">{formatWhen(item.startsAt)} · {item.placeName}, {item.city}</p>
          {(item.isHost || item.myStatus === "accepted") && countdownLabel(item.startsAt) ? (
            <p className="inline-flex rounded-full bg-accent px-3 py-1 text-sm font-semibold text-onfill">{countdownLabel(item.startsAt)}</p>
          ) : null}
          <p className="text-sm">{item.description}</p>
          <p className="text-sm text-muted">{item.spotsLeft} von {item.spots} Plätzen frei · {item.category}</p>
          {item.cancelled ? <Note>Diese Aktivität ist abgesagt.</Note> : null}
        </div>
      </div>
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{business ? "Ansprechperson" : "Gastgeber"}</p>
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
            <p className="text-sm text-muted">{item.hostOrganizer ? "Veranstalter" : business ? "Business-Kontakt" : "Privates Treffen"}</p>
          </div>
        </div>
        <div className="mt-3">
          <BadgeRow badges={item.hostBadges} />
        </div>
        {!item.isHost && data.hostReplyHours != null ? (
          <p className="mt-3 text-sm text-muted">Antwortet meist innerhalb von {replyLabel(data.hostReplyHours)}.</p>
        ) : null}
      </div>
      {data.going.length > 0 ? (
        <div className="card space-y-3 p-4">
          <h2 className="font-display text-2xl">Wer noch dabei ist</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {data.going.map((person) => (
              <div key={person.id} className="w-16 shrink-0 text-center">
                {person.avatar ? (
                  <img src={person.avatar} alt="" className="mx-auto h-14 w-14 rounded-full object-cover" />
                ) : (
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sand-deep text-lg font-semibold">{person.name.slice(0, 1)}</span>
                )}
                <span className="mt-1 block truncate text-xs font-bold">{person.me ? "Du" : person.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {!item.isHost && !item.cancelled && item.myStatus !== "accepted" && item.myStatus !== "pending" ? (
        <div className="card space-y-3 p-4">
          <h2 className="font-display text-2xl">Was erwartest du heute?</h2>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((item) => (
              <button key={item} type="button" onClick={() => setMood(item)} className={`inline-flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold ${mood === item ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>{item}</button>
            ))}
          </div>
          <p className="text-sm text-muted">Der Ersteller sieht das bei deiner Anfrage.</p>
        </div>
      ) : null}
      <div className="card space-y-2 p-4">
        <h2 className="font-display text-2xl">{oneToOne ? "Vor dem Treffen" : "Weitergeben"}</h2>
        <p className="text-sm text-muted">
          {oneToOne
            ? "Erstes Date nur an diesem öffentlichen Ort. Die Vertrauensperson bekommt Zeit und Ort, wenn du den Text weiterleitest."
            : "Schick das Treffen an jemanden, der dazugehört."}
        </p>
        <Button type="button" tone="ghost" className="w-full" onClick={() => { setTrust(null); setShareOpen(true); }}>Teilen</Button>
        {item.myStatus === "accepted" || item.isHost ? (
          <Button type="button" tone="ghost" className="w-full" disabled={busy} onClick={invite}>Mit Link einladen</Button>
        ) : null}
        {item.myStatus === "accepted" || item.isHost ? (
          <Button type="button" tone="ghost" className="w-full" disabled={busy} onClick={trustLink}>Vertrauensperson informieren</Button>
        ) : null}
        {item.isHost && !item.cancelled ? (
          <div className="flex gap-2">
            <select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} aria-label="Wie viele Wochen" className="h-12 rounded-full border border-line bg-card px-4 text-sm font-semibold">
              {[1, 4, 8, 12].map((count) => <option key={count} value={count}>{count === 1 ? "Nächste Woche" : `${count} Wochen`}</option>)}
            </select>
            <Button type="button" tone="ghost" className="flex-1" disabled={busy} onClick={again}>{weeks === 1 ? "Nochmal anlegen" : "Als Serie anlegen"}</Button>
          </div>
        ) : null}
        {oneToOne ? (
          <a className="inline-flex h-12 items-center justify-center rounded-full border-2 border-ink bg-card px-4 text-sm font-semibold" href="tel:112">Notfall 112</a>
        ) : null}
      </div>
      {!item.isHost ? <SafetyMenu kind="activity" targetId={item.id} personId={item.hostId} personName={item.hostName.split(" ")[0]} onBlocked={() => navigate({ to: "/" })} /> : null}
      <ShareSheet open={shareOpen} title={trust ? trust.title : item.title} text={trust ? trust.text : shareText} onClose={() => setShareOpen(false)} />
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
              {item.bookingMode === "instant" ? "Sofort dabei" : business ? "Kontakt anfragen" : "Anfragen"}
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
