import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/bits";
import { groupChemistry } from "@/lib/meeqo/design";
import { groupSign } from "@/lib/meeqo/companion";
import { berlinDay } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { buzz } from "@/lib/meeqo/feel";
import { t } from "@/lib/meeqo/i18n";
import type { GoingPerson } from "@/lib/meeqo/types";

const clock = (iso: string) => new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));

/** "Morgen siehst du Mira": names only for people who are already in the group. */
export function Anticipation({ startsAt, isHost, hostName, going }: { startsAt: string; isHost: boolean; hostName: string; going: GoingPerson[] }) {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  if (start <= now || start - now > 3 * 86_400_000) return null;
  const others = isHost ? going.filter((person) => !person.me).map((person) => person.name.split(" ")[0]) : [hostName.split(" ")[0], ...going.filter((person) => !person.me).map((person) => person.name.split(" ")[0])];
  if (!others.length) return null;
  const who = others.length === 1 ? others[0] : others.length === 2 ? t("{0} und {1}", others[0], others[1]) : t("{0} und {1} weitere", others[0], others.length - 1);
  const day = berlinDay(startsAt) === berlinDay() ? "today" : berlinDay(startsAt) === berlinDay(new Date(now + 86_400_000)) ? "tomorrow" : "later";
  const line = day === "today" ? t("Heute um {0} siehst du {1}", clock(startsAt), who) : day === "tomorrow" ? t("Morgen siehst du {0}", who) : t("Bald siehst du {0}", who);
  return <p className="font-display text-2xl leading-tight text-accent-deep">{line}</p>;
}

function Shape({ shape, color }: { shape: string; color: string }) {
  const common = { fill: color };
  return (
    <svg viewBox="0 0 40 40" className="h-14 w-14" aria-hidden="true">
      {shape === "Kreis" ? <circle cx="20" cy="20" r="16" {...common} /> : null}
      {shape === "Dreieck" ? <polygon points="20,4 37,35 3,35" {...common} /> : null}
      {shape === "Quadrat" ? <rect x="5" y="5" width="30" height="30" rx="4" {...common} /> : null}
      {shape === "Raute" ? <polygon points="20,2 38,20 20,38 2,20" {...common} /> : null}
    </svg>
  );
}

/** Group recognition sign on site: the same colour and shape for everyone in this meetup, from 2 hours before until the end. */
export function GroupSign({ id, startsAt, durationMin }: { id: string; startsAt: string; durationMin: number }) {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  if (now < start - 2 * 3_600_000 || now > start + durationMin * 60_000) return null;
  const sign = groupSign(id);
  return (
    <div className="card flex items-center gap-4 p-4">
      <Shape shape={sign.shape} color={sign.color.hex} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Euer Erkennungszeichen")}</p>
        <p className="font-display text-2xl leading-tight">{t(sign.color.key)} · {t(sign.shape)}</p>
        <p className="text-sm text-muted">{t("Alle aus eurer Gruppe sehen dasselbe. Zeig es kurz am Treffpunkt.")}</p>
      </div>
    </div>
  );
}

const CARDS = [
  "Was war das Beste an deiner Woche?",
  "Welcher Ort in der Stadt ist unterschätzt?",
  "Was wolltest du schon immer mal ausprobieren?",
  "Wie bist du heute hier gelandet?",
  "Was ist dein liebstes Essen nach einem langen Tag?",
  "Welches Hobby hattest du als Kind?",
];

/** Icebreaker cards, revealed one by one on site. */
export function IcebreakerCards({ id, startsAt }: { id: string; startsAt: string }) {
  const [shown, setShown] = useState(0);
  const start = new Date(startsAt).getTime();
  if (Date.now() < start - 30 * 60_000) return null;
  const offset = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % CARDS.length;
  const deck = [...CARDS.slice(offset), ...CARDS.slice(0, offset)];
  return (
    <div className="card space-y-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Eisbrecher")}</p>
      {shown === 0 ? (
        <p className="text-sm text-muted">{t("Eine Karte für die Runde. Aufdecken, vorlesen, reihum antworten.")}</p>
      ) : (
        <p key={shown} className="animate-[cardin_.35s_ease-out] rounded-control bg-accent px-4 py-6 text-center font-display text-2xl leading-tight text-onfill">{t(deck[(shown - 1) % deck.length])}</p>
      )}
      <Button type="button" tone="ghost" className="w-full" onClick={() => { buzz(); setShown((value) => value + 1); }}>{shown === 0 ? t("Karte aufdecken") : t("Nächste Karte")}</Button>
    </div>
  );
}

/** Group chemistry: shared interests as counts. No names, nothing private. */
export function Chemistry({ id }: { id: string }) {
  const { data } = useLoad(() => groupChemistry({ data: { id } }), [id]);
  if (!data || !data.shared.length) return null;
  return (
    <div className="card space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-friend" aria-hidden="true" />{t("Was die Gruppe verbindet")}</p>
      <div className="flex flex-wrap gap-1.5">
        {data.shared.map((item) => (
          <span key={item.label} className="inline-flex h-8 items-center rounded-control bg-green/30 px-3 text-sm font-semibold text-ink">{t(item.label)} · {t("{0} von {1}", item.count, data.people)}</span>
        ))}
      </div>
      <p className="text-xs text-muted">{t("Nur gemeinsame Interessen, gezählt. Keine Namen.")}</p>
    </div>
  );
}

export const CANCEL_TEMPLATES = [
  "Sorry, mir ist leider etwas dazwischengekommen. Viel Spaß euch!",
  "Ich schaffe es heute nicht, tut mir leid. Gern beim nächsten Mal!",
  "Ich bin krank geworden und bleibe lieber zu Hause. Habt eine gute Zeit!",
];
