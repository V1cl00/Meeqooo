import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeRow, Button, IntentPill, MinGroupLine, Note, Skeleton, SparteStrip, StatusLine } from "@/components/bits";
import { RidesCard } from "@/components/rides";
import { SafetyMenu } from "@/components/safety";
import { icsFor, mapUrl } from "@/lib/meeqo/ics";
import { activityLink, openShare, ShareSheet } from "@/components/share";
import { Shell, useMe } from "@/components/shell";
import { isPhotoMissing, PhotoMissing } from "@/components/photo";
import { checkIn, confirmAttendance, confirmSafe, createInvite, createSafetyLink, getActivity, hideActivity, leaveActivity, removeGuest, repeatActivity, requestJoin, unhideActivity } from "@/lib/meeqo/api";
import { bookingLabel, countdownLabel, errText, formatWhen, MOODS, replyLabel, sparteOf } from "@/lib/meeqo/labels";
import { notice } from "@/lib/meeqo/feel";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";
import { WeatherChip } from "@/components/weather-chip";
import { HostTrust } from "@/components/host-trust";
import { getShareMeta, shareMetaTags } from "@/lib/meeqo/share";

export const Route = createFileRoute("/activity/$id")({
  // Link previews (WhatsApp, Telegram, iMessage) read these tags from the server-rendered HTML.
  loader: ({ params }) => getShareMeta({ data: { id: params.id } }).catch(() => undefined),
  head: ({ loaderData }) => ({ meta: shareMetaTags(loaderData) }),
  component: Page,
});

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
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [mood, setMood] = useState<string>(MOODS[0]);
  const [trust, setTrust] = useState<{ title: string; text: string } | null>(null);
  const [weeks, setWeeks] = useState(1);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [needPhoto, setNeedPhoto] = useState(false);
  const { profile } = useMe();
  const item = data?.activity;

  /** photoJustAdded: called right after the inline upload, when `profile` in this closure is still the old one. */
  async function join(photoJustAdded = false) {
    if (!item) return;
    if (!photoJustAdded && profile && !profile.avatarUrl) {
      setNeedPhoto(true);
      return;
    }
    setBusy(true);
    setFail("");
    setNeedPhoto(false);
    try {
      const result = await requestJoin({ data: { id: item.id, mood: item.area !== "event" && item.bookingMode !== "instant" ? mood : "" } });
      const reply = data?.hostReplyHours != null ? " " + t("{0} antwortet meist in {1}.", item.hostName.split(" ")[0], replyLabel(data.hostReplyHours)) : "";
      notice(result.status === "waitlist" ? t("Du stehst auf der Warteliste. Wenn ein Platz frei wird, rückst du nach.") : result.status === "accepted" ? t("Du bist dabei. Der Chat ist offen.") : t("Anfrage ist raus.{0} Du bekommst eine Mitteilung, sobald es eine Antwort gibt.", reply));
      reload();
    } catch (err) {
      if (isPhotoMissing(err)) setNeedPhoto(true);
      else setFail(errText(err));
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
      setTrust({ title: t("Mein Treffen"), text: t("Ich gehe zu „{0}“ ({1}, {2}, {3}). Hier siehst du, ob ich eingecheckt bin: {4}", item.title, formatWhen(item.startsAt), item.placeName, item.city, url) });
      setShareOpen(true);
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function addToCalendar() {
    if (!item) return;
    const blob = new Blob([icsFor(item)], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "meeqo-treffen.ics";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function invite() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      const result = await createInvite({ data: { id: item.id } });
      const url = `${window.location.origin}${result.path}`;
      setTrust({ title: item.title, text: t("Komm mit zu „{0}“ ({1}, {2}, {3}). Hier siehst du das Treffen und kannst anfragen: {4}", item.title, formatWhen(item.startsAt), item.placeName, item.city, url) });
      setShareOpen(true);
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function allGood() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      await confirmSafe({ data: { id: item.id } });
      notice("Gut. Deine Vertrauensperson sieht es.");
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      await leaveActivity({ data: { id: item.id } });
      notice(item.myStatus === "waitlist" ? t("Du bist nicht mehr auf der Warteliste.") : t("Du bist raus. Der Platz ist wieder frei."));
      setConfirmLeave(false);
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function takeOut(userId: string) {
    if (!item) return;
    setBusy(true);
    setFail("");
    try {
      await removeGuest({ data: { id: item.id, userId } });
      notice(t("Die Person ist nicht mehr dabei."));
      setConfirmRemove(null);
      reload();
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
      notice(result.status === "confirmed" ? t("Gut, bis dann.") : t("Schade. Dein Platz ist wieder frei."));
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
      notice(t("Check-in gespeichert. Bewertung ist frei."));
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
      notice(t("Wieder im Feed."));
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton photo lines={4} />;
  if (error || !item || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;
  const sparte = sparteOf(item.area, item.category);
  const business = sparte.kind === "business";
  const oneToOne = !business && item.intent === "date" && item.spots <= 2;
  const sharePayload = { title: item.title, text: t("{0} · {1} · {2}", item.title, formatWhen(item.startsAt), item.placeName), url: activityLink(item.id), activityId: item.id };

  return (
    <article className="space-y-4">
      {data.needsConfirm ? (
        <div className="card space-y-3 border-2 !border-accent p-4">
          <h2 className="font-display text-2xl leading-tight">{countdownLabel(item.startsAt) === "morgen" ? t("Bist du morgen dabei?") : t("Bist du dabei?")}</h2>
          <p className="text-sm text-muted">{t("Sag kurz Bescheid. Wenn du nicht kannst, wird dein Platz für andere frei.")}</p>
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={busy} onClick={() => attend(true)}>{t("Ja, ich komme")}</Button>
            <Button type="button" tone="ghost" className="flex-1" disabled={busy} onClick={() => attend(false)}>{t("Doch nicht")}</Button>
          </div>
        </div>
      ) : null}
      {data.checkedIn && !data.safe ? (
        <div className="card flex items-center justify-between gap-3 border-2 !border-friend p-4">
          <p className="text-sm font-semibold">{t("Alles gut? Sag kurz Bescheid.")}</p>
          <Button type="button" tone="ink" className="h-11 shrink-0" disabled={busy} onClick={allGood}>{t("Gut angekommen")}</Button>
        </div>
      ) : null}
      <div className={`card overflow-hidden ${business ? "!border-2 !border-ink" : sparte.kind === "event" ? "!border-2 !border-accent-deep" : ""}`}>
        <SparteStrip kind={sparte.kind} sub={sparte.sub} />
        {item.imageUrl ? <img src={item.imageUrl} alt="" className="aspect-[3/2] w-full object-cover" /> : <div className="aspect-[3/2] bg-sand-deep" />}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {business ? null : <IntentPill intent={item.intent} />}
            <span className="rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">{bookingLabel(item.bookingMode)}</span>
            {item.publicPlace ? <span className="rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">{t("Öffentlicher Ort")}</span> : null}
          </div>
          <h1 className="font-display text-4xl leading-none">{item.title}</h1>
          <p className="text-sm text-muted">{formatWhen(item.startsAt)} · {item.placeName}, {item.city}</p>
          {(item.isHost || item.myStatus === "accepted") && countdownLabel(item.startsAt) ? (
            <p className="inline-flex rounded-full bg-accent px-3 py-1 text-sm font-semibold text-onfill">{countdownLabel(item.startsAt)}</p>
          ) : null}
          {item.cancelled ? null : <WeatherChip id={item.id} />}
          <p className="text-sm">{item.description}</p>
          {item.isHost && data.going.length > 0 ? <p className="text-sm text-muted">{t("{0} von {1} haben zugesagt, dass sie kommen.", data.confirmedCount, data.going.length)}</p> : null}
          <p className="text-sm text-muted">{t("{0} von {1} Plätzen frei · {2} · {3} Min.", item.spotsLeft, item.spots, item.category, item.durationMin)}</p>
          {item.stillNeeded > 0 && !item.cancelled ? <MinGroupLine missing={item.stillNeeded} /> : null}
          {item.cancelled ? <Note>{t("Diese Aktivität ist abgesagt.")}</Note> : null}
        </div>
      </div>
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{business ? t("Ansprechperson") : t("Gastgeber")}</p>
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
            <p className="text-sm text-muted">{item.hostOrganizer ? t("Veranstalter") : business ? t("Business-Kontakt") : t("Privates Treffen")}</p>
          </div>
        </div>
        <div className="mt-3">
          <BadgeRow badges={item.hostBadges} />
        </div>
        <HostTrust hostId={item.hostId} />
        {!item.isHost && data.hostReplyHours != null ? (
          <p className="mt-3 text-sm text-muted">{t("Antwortet meist innerhalb von {0}.", replyLabel(data.hostReplyHours))}</p>
        ) : null}
      </div>
      {data.going.length > 0 ? (
        <div className="card space-y-3 p-4">
          <h2 className="font-display text-2xl">{t("Wer noch dabei ist")}</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {data.going.map((person) => (
              <div key={person.id} className="w-16 shrink-0 text-center">
                {person.avatar ? (
                  <img src={person.avatar} alt="" className="mx-auto h-14 w-14 rounded-full object-cover" />
                ) : (
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sand-deep text-lg font-semibold">{person.name.slice(0, 1)}</span>
                )}
                <span className="mt-1 block truncate text-xs font-bold">{person.me ? t("Du") : person.name.split(" ")[0]}</span>
                {item.isHost && !person.me ? (
                  confirmRemove === person.id ? (
                    <button type="button" disabled={busy} onClick={() => takeOut(person.id)} className="mt-1 text-xs font-bold text-accent-deep underline">{t("Wirklich?")}</button>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemove(person.id)} className="mt-1 text-xs font-semibold text-muted underline">{t("Entfernen")}</button>
                  )
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* Only for request-based meetups: organizer events and instant booking have no request the host would read. */}
      {!item.isHost && !item.cancelled && item.area !== "event" && item.bookingMode !== "instant" && item.myStatus !== "accepted" && item.myStatus !== "pending" && item.myStatus !== "waitlist" ? (
        <div className="card space-y-3 p-4">
          <h2 className="font-display text-2xl">{t("Was erwartest du heute?")}</h2>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((item) => (
              <button key={item} type="button" onClick={() => setMood(item)} className={`inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${mood === item ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>{t(item)}</button>
            ))}
          </div>
          <p className="text-sm text-muted">{t("Der Ersteller sieht das bei deiner Anfrage.")}</p>
        </div>
      ) : null}
      {item.isHost || item.myStatus === "accepted" ? <RidesCard activityId={item.id} /> : null}
      <div className="card space-y-2 p-4">
        <h2 className="font-display text-2xl">{oneToOne ? t("Vor dem Treffen") : t("Weitergeben")}</h2>
        <p className="text-sm text-muted">
          {oneToOne
            ? t("Erstes Date nur an diesem öffentlichen Ort. Die Vertrauensperson bekommt Zeit und Ort, wenn du den Text weiterleitest.")
            : t("Schick das Treffen an jemanden, der dazugehört.")}
        </p>
        <Button type="button" tone="ghost" className="w-full" onClick={() => { setTrust(null); void openShare(sharePayload, () => setShareOpen(true)); }}>{t("Teilen")}</Button>
        <div className="flex gap-2">
          <a href={mapUrl(item.lat, item.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center rounded-control border border-line bg-card px-4 text-sm font-semibold">{t("Karte öffnen")}</a>
          {item.myStatus === "accepted" || item.isHost ? (
            <button type="button" onClick={addToCalendar} className="inline-flex h-12 flex-1 items-center justify-center rounded-control border border-line bg-card px-4 text-sm font-semibold">{t("Zum Kalender")}</button>
          ) : null}
        </div>
        {item.myStatus === "accepted" || item.isHost ? (
          <Button type="button" tone="ghost" className="w-full" disabled={busy} onClick={invite}>{t("Mit Link einladen")}</Button>
        ) : null}
        {item.myStatus === "accepted" || item.isHost ? (
          <Button type="button" tone="ghost" className="w-full" disabled={busy} onClick={trustLink}>{t("Vertrauensperson informieren")}</Button>
        ) : null}
        {item.isHost && !item.cancelled ? (
          <div className="flex gap-2">
            <select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} aria-label={t("Wie viele Wochen")} className="h-12 rounded-control border border-line bg-card px-4 text-sm font-semibold">
              {[1, 4, 8, 12].map((count) => <option key={count} value={count}>{count === 1 ? t("Nächste Woche") : t("{0} Wochen", count)}</option>)}
            </select>
            <Button type="button" tone="ghost" className="flex-1" disabled={busy} onClick={again}>{weeks === 1 ? t("Nochmal anlegen") : t("Als Serie anlegen")}</Button>
          </div>
        ) : null}
        {oneToOne ? (
          <a className="inline-flex h-12 items-center justify-center rounded-control border-2 border-ink bg-card px-4 text-sm font-semibold" href="tel:112">{t("Notfall 112")}</a>
        ) : null}
      </div>
      {!item.isHost ? <SafetyMenu kind="activity" targetId={item.id} personId={item.hostId} personName={item.hostName.split(" ")[0]} onBlocked={() => navigate({ to: "/" })} /> : null}
      <ShareSheet open={shareOpen} {...(trust ?? sharePayload)} onClose={() => setShareOpen(false)} />
      <StatusLine error={fail} />
      {data.hidden ? <Note>{t("Diese Aktivität ist für dich ausgeblendet. Feed, Suche und Vorschläge überspringen sie.")}</Note> : null}
      {data.mutual ? <Note>{t("Ihr möchtet euch beide wiedersehen.")}</Note> : null}
      <div className="flex flex-wrap gap-1.5 pb-16">
        {!item.isHost && !data.hidden ? (
          <Button type="button" tone="ghost" disabled={busy} onClick={conceal}>{t("Ausblenden")}</Button>
        ) : null}
        {!item.isHost && data.hidden ? (
          <Button type="button" tone="ghost" disabled={busy} onClick={reveal}>{t("Wieder zeigen")}</Button>
        ) : null}
        {item.myStatus === "pending" ? <Note>{t("Wartet auf Freigabe.")}</Note> : null}
        {item.myStatus === "waitlist" ? <Note>{t("Du bist auf der Warteliste{0}. Sagt jemand ab, rückst du nach.", data.waitlistPosition ? t(", Platz {0}", data.waitlistPosition) : "")}</Note> : null}
        {!item.isHost && !item.cancelled && (item.myStatus === "accepted" || item.myStatus === "pending" || item.myStatus === "waitlist") ? (
          confirmLeave ? (
            <Button type="button" tone="ink" disabled={busy} onClick={leave}>{item.myStatus === "waitlist" ? t("Ja, von der Warteliste") : t("Ja, ich sage ab")}</Button>
          ) : (
            <Button type="button" tone="ghost" disabled={busy} onClick={() => setConfirmLeave(true)}>{item.myStatus === "waitlist" ? t("Warteliste verlassen") : t("Absagen")}</Button>
          )
        ) : null}
        {item.isHost && !item.cancelled ? <Link to="/bearbeiten/$id" params={{ id: item.id }} className="inline-flex h-12 items-center rounded-control border border-line bg-card px-5 text-sm font-semibold">{t("Bearbeiten")}</Link> : null}
        {item.isHost && data.waitlistCount > 0 ? <Note>{t("{0} {1} auf einen Platz.", data.waitlistCount, data.waitlistCount === 1 ? t("Person wartet") : t("Leute warten"))}</Note> : null}
        {(item.myStatus === "accepted" || item.isHost) && !data.checkedIn ? <Button type="button" tone="ghost" disabled={busy} onClick={arrive}>{t("Check-in")}</Button> : null}
        {(item.myStatus === "accepted" || item.isHost) && !item.cancelled && new Date(item.startsAt).getTime() <= Date.now() ? <Link to="/wie-wars/$id" params={{ id: item.id }} className="inline-flex h-12 items-center rounded-control bg-green px-5 text-sm font-semibold text-ink">{t("Wie war's?")}</Link> : null}
        {(item.myStatus === "accepted" || item.isHost) && data.checkedIn ? <Link to="/rating/$id" params={{ id: item.id }} className="inline-flex h-12 items-center rounded-control border border-line bg-card px-5 text-sm font-semibold">{t("Bewerten")}</Link> : null}
      </div>
      <div className="fixed inset-x-0 bottom-[5.4rem] z-20 px-3 md:bottom-6">
        {needPhoto ? (
          <div className="mx-auto mb-2 max-w-lg">
            <PhotoMissing onDone={() => { setNeedPhoto(false); void join(true); }} />
          </div>
        ) : null}
        <div className="mx-auto flex max-w-lg gap-2">
          {!item.isHost && !item.cancelled && item.myStatus !== "accepted" && item.myStatus !== "pending" && item.myStatus !== "waitlist" ? (
            <Button type="button" disabled={busy} className="h-12 flex-1" onClick={() => void join()}>
              {item.spotsLeft < 1 ? t("Auf die Warteliste") : item.bookingMode === "instant" ? t("Sofort dabei") : business ? t("Kontakt anfragen") : t("Anfragen")}
            </Button>
          ) : null}
          {item.myStatus === "accepted" || item.isHost ? (
            <Link to="/chat/$id" params={{ id: item.id }} className="inline-flex h-12 flex-1 items-center justify-center rounded-control bg-ink px-5 text-sm font-semibold text-onaccent">{item.spots > 2 ? t("Gruppenchat") : t("Chat")}</Link>
          ) : null}
          {oneToOne ? (
            <a className="inline-flex h-12 shrink-0 items-center justify-center rounded-control border-2 border-ink bg-card px-4 text-sm font-semibold" href="tel:112">112</a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
