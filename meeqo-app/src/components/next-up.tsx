import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Navigation, ShieldCheck } from "lucide-react";
import { Button } from "@/components/bits";
import { checkIn, confirmSafe, nextUp } from "@/lib/meeqo/api";
import { notice } from "@/lib/meeqo/feel";
import { countdownLabel, errText, formatWhen } from "@/lib/meeqo/labels";
import { routeUrl } from "@/lib/meeqo/ics";
import { useLoad, usePolling } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

/** The meetup you are going to next, first thing on the screen: when, where, the way there, check-in, chat. */
export function NextUpCard() {
  const { data, refresh } = useLoad(() => nextUp(), []);
  const [fail, setFail] = useState("");
  usePolling(refresh, 60);
  if (!data) return null;

  const running = new Date(data.startsAt).getTime() <= Date.now();
  const label = running ? t("Läuft gerade") : countdownLabel(data.startsAt);

  async function arrive() {
    setFail("");
    try {
      await checkIn({ data: { id: data!.id } });
      notice(t("Eingecheckt. Viel Spaß."));
      refresh();
    } catch (err) {
      setFail(errText(err));
    }
  }

  async function safe() {
    setFail("");
    try {
      await confirmSafe({ data: { id: data!.id } });
      notice(data!.hasSafetyLink ? "Gut, deine Vertrauensperson sieht es." : t("Schön, dass alles gut ist."));
      refresh();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <section className="card overflow-hidden !border-2 !border-accent" aria-label={t("Als Nächstes")}>
      <div className="flex items-center justify-between gap-2 bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-onfill">
        <span>{t("Als Nächstes")}</span>
        {label ? <span className="normal-case tracking-normal">{label}</span> : null}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <Link to="/activity/$id" params={{ id: data.id }} className="font-display text-2xl leading-tight">{data.title}</Link>
          <p className="mt-1 text-sm text-muted">{formatWhen(data.startsAt)} · {data.placeName}, {data.city}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={routeUrl(data.lat, data.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold">
            <Navigation className="h-4 w-4" />{t("Weg")}</a>
          {data.canCheckIn && !data.checkedIn ? <Button type="button" className="h-11" onClick={arrive}>{t("Einchecken")}</Button> : null}
          {data.chatOpen ? (
            <Link to="/chat/$id" params={{ id: data.id }} className="inline-flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">{data.group ? t("Gruppenchat") : t("Chat")}</Link>
          ) : null}
        </div>
        {data.checkedIn && !data.safe ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-sand-deep px-4 py-3">
            <p className="text-sm">{t("Alles gut? Sag kurz Bescheid.")}</p>
            <Button type="button" tone="ink" className="h-11 shrink-0" onClick={safe}>{t("Gut angekommen")}</Button>
          </div>
        ) : null}
        {data.safe ? <p className="flex items-center gap-2 text-sm font-semibold text-friend"><ShieldCheck className="h-4 w-4" />{t("Du hast Bescheid gesagt.")}</p> : null}
        {!data.hasSafetyLink && !data.safe && !data.hosting ? (
          <Link to="/activity/$id" params={{ id: data.id }} className="text-sm font-semibold underline">{t("Vertrauensperson informieren")}</Link>
        ) : null}
        {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
      </div>
    </section>
  );
}
