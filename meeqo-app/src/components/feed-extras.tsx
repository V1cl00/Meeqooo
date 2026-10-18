import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Timer } from "lucide-react";
import { cityPulse, friendsFree, myFreeSignal, setFreeSignal } from "@/lib/meeqo/design";
import { type Mood, type Pick, sliderStops, weekPicks } from "@/lib/meeqo/companion";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { notice } from "@/lib/meeqo/feel";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";
import type { ActivityCard as Card } from "@/lib/meeqo/types";

const clock = (iso: string) => new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** "Gerade N Treffen in Karlsruhe": real public meetups only, no demo accounts. Hidden when both numbers are 0. */
export function CityScene({ city }: { city: string }) {
  const { data } = useLoad(() => cityPulse({ data: { city: city || "Karlsruhe" } }), [city]);
  if (!data || (data.running === 0 && data.today === 0)) return null;
  return (
    <section className="relative overflow-hidden rounded-card bg-ink px-4 py-4 text-onaccent" aria-label={t("In der Stadt")}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{data.city}</p>
      <p className="font-display text-2xl leading-tight">
        {data.running > 0 ? (data.running === 1 ? t("Gerade 1 Treffen in {0}", data.city) : t("Gerade {0} Treffen in {1}", data.running, data.city)) : t("Heute noch {0} Treffen in {1}", data.today, data.city)}
      </p>
      {data.running > 0 && data.today > 0 ? <p className="text-sm opacity-80">{t("Heute kommen noch {0} dazu.", data.today)}</p> : null}
      <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-green/40" aria-hidden="true" />
    </section>
  );
}

const MOODS: [Mood, string][] = [["ruhig", "Ruhig"], ["aktiv", "Aktiv"], ["neu", "Neu ausprobieren"]];

export function readMood(): Mood {
  try {
    const value = window.localStorage.getItem("meeqo-mood");
    return value === "ruhig" || value === "aktiv" || value === "neu" ? value : "";
  } catch {
    return "";
  }
}

/** Mood check: sorts the feed, filters nothing. Stays on this device. */
export function MoodBar({ mood, onChange }: { mood: Mood; onChange: (next: Mood) => void }) {
  function choose(next: Mood) {
    const value = mood === next ? "" : next;
    onChange(value);
    try {
      window.localStorage.setItem("meeqo-mood", value);
    } catch {
      /* not kept */
    }
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-ink">{t("Wonach ist dir?")}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("Stimmung")}>
        {MOODS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={mood === id} onClick={() => choose(id)} className={`inline-flex h-10 items-center rounded-control px-3.5 text-sm font-semibold ${mood === id ? "bg-green text-ink" : "border border-line bg-card text-ink"}`}>{t(label)}</button>
        ))}
      </div>
    </div>
  );
}

/** Time slider for today: from "jetzt" to "heute Abend". */
export function TimeSlider({ hours, onChange }: { hours: number; onChange: (next: number) => void }) {
  const stops = sliderStops();
  const value = Math.min(hours, stops);
  const until = new Date(Date.now() + value * 3_600_000);
  const label = value >= stops ? t("Heute Abend, alles") : value <= 1 ? t("Jetzt, in der nächsten Stunde") : t("Bis {0} Uhr", clock(until.toISOString()));
  return (
    <div className="card space-y-1 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-ink">{label}</span>
      </div>
      <input type="range" min={1} max={stops} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={t("Zeitraum heute")} className="w-full accent-[var(--color-accent)]" />
      <div className="flex justify-between text-[11px] text-muted"><span>{t("jetzt")}</span><span>{t("heute Abend")}</span></div>
    </div>
  );
}

const REASON: Record<Pick<Card>["reason"], string> = {
  friends: "Freunde sind dabei",
  interest: "Passt zu deinen Interessen",
  mood: "Passt zu deiner Stimmung",
  near: "Ganz in der Nähe",
  soon: "Noch Platz frei",
};

/** Companion: three picks for the week, by simple rules on this device. */
export function WeekPicks({ items, mood, seeking }: { items: Card[]; mood: Mood; seeking: string[] }) {
  const picks = weekPicks(items, mood, seeking);
  if (!picks.length) return null;
  return (
    <section className="card space-y-2 p-4" aria-label={t("Deine Woche: 3 Vorschläge")}>
      <h2 className="flex items-center gap-2 font-display text-2xl"><Sparkles className="h-5 w-5 text-accent" aria-hidden="true" />{picks.length === 3 ? t("Deine 3 für diese Woche") : t("Für diese Woche")}</h2>
      <p className="text-xs text-muted">{t("Nach einfachen Regeln ausgesucht: Interessen, Freunde, Stimmung, Nähe. Nichts verlässt dein Gerät.")}</p>
      <ol className="space-y-2">
        {picks.map(({ item, reason }, index) => (
          <li key={item.id}>
            <Link to="/activity/$id" params={{ id: item.id }} className="flex items-center gap-3 rounded-control bg-sand px-3 py-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent font-display text-lg text-onfill">{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.title}</span>
                <span className="block truncate text-xs text-muted">{formatWhen(item.startsAt)} · {t(REASON[reason])}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "Ich hab jetzt 2 Std Zeit": opt-in, only confirmed friends see it, ends by itself. */
export function FreeSignal() {
  const mine = useLoad(() => myFreeSignal(), []);
  const friends = useLoad(() => friendsFree(), []);
  const [until, setUntil] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setUntil(mine.data?.until ?? null), [mine.data]);

  async function toggle() {
    setBusy(true);
    try {
      const result = await setFreeSignal({ data: { on: !until, hours: 2 } });
      setUntil(result.until);
      notice(result.until ? t("Deine Freunde sehen bis {0} Uhr, dass du Zeit hast.", clock(result.until)) : t("Zeitsignal aus."));
    } catch (err) {
      notice(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      {(friends.data ?? []).map((person) => (
        <Link key={person.userId} to="/freunde/$id" params={{ id: person.userId }} className="card flex items-center gap-3 p-3">
          {person.avatar ? <img src={person.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-sand-deep font-semibold">{person.name.slice(0, 1)}</span>}
          <span className="min-w-0 flex-1 text-sm"><span className="font-semibold">{person.name.split(" ")[0]}</span> {t("hat bis {0} Uhr Zeit", clock(person.until))}</span>
          <span className="text-xs font-semibold text-accent-deep">{t("Schreiben")}</span>
        </Link>
      ))}
      <button type="button" disabled={busy} aria-pressed={Boolean(until)} onClick={() => void toggle()} className={`flex w-full items-center gap-3 rounded-control px-4 py-3 text-left ${until ? "bg-green text-ink" : "border border-dashed border-line bg-card text-ink"}`}>
        <Timer className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{until ? t("Du hast Zeit bis {0} Uhr", clock(until)) : t("Ich hab jetzt 2 Std Zeit")}</span>
          <span className="block text-xs text-muted">{until ? t("Tippen zum Beenden. Nur Freunde sehen das.") : t("Nur deine Freunde sehen es, kein Standort. Endet von selbst.")}</span>
        </span>
      </button>
    </section>
  );
}
