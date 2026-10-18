import { useMemo, useState } from "react";
import { CalendarSubscribe } from "@/components/cal-subscribe";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Empty, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { getFeed, listRequests } from "@/lib/meeqo/api";
import { berlinDay } from "@/lib/meeqo/labels";
import type { ActivityCard } from "@/lib/meeqo/types";
import { useLoad } from "@/lib/meeqo/use-load";
import { locale, t } from "@/lib/meeqo/i18n";
import { drawTicket, saveOrShare } from "@/lib/meeqo/canvas-cards";

export const Route = createFileRoute("/calendar")({ component: Page });

function Page() {
  return (
    <Shell>
      <MyDates />
    </Shell>
  );
}

type Kind = "host" | "accepted" | "pending";
type Entry = { item: ActivityCard; kind: Kind; day: string; open: number };

/** Shift a YYYY-MM-DD day by whole days (noon UTC keeps it clear of DST edges). */
function shift(day: string, by: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + by);
  return date.toISOString().slice(0, 10);
}
function mondayOf(day: string) {
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return shift(day, -weekday);
}
function fmt(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale(), { ...options, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}
function timeOf(iso: string) {
  return new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
}
function dayTitle(day: string, today: string) {
  if (day === today) return t("Heute");
  if (day === shift(today, 1)) return t("Morgen");
  if (day === shift(today, -1)) return t("Gestern");
  return fmt(day, { weekday: "long", day: "numeric", month: "long" });
}

const CHIP: Record<Kind, { label: string; className: string }> = {
  host: { label: "Veranstalter", className: "bg-ink text-onaccent" },
  accepted: { label: "Zugesagt", className: "bg-friend text-white" },
  pending: { label: "Angefragt", className: "bg-warn text-onwarn" },
};

/** "Meine Termine": only what I host, joined or asked for. Discovery stays on Entdecken. */
function MyDates() {
  const today = berlinDay();
  const [week, setWeek] = useState(() => mondayOf(today));
  const [pastOpen, setPastOpen] = useState(false);
  const [picked, setPicked] = useState("");
  const feed = useLoad(() => getFeed({ data: { mineOnly: true, includePast: true, radiusKm: 500, limit: 200 } }), []);
  const requests = useLoad(() => listRequests(), []);

  const entries = useMemo<Entry[]>(() => {
    const pending = new Map<string, number>();
    for (const row of requests.data ?? []) if (row.status === "pending") pending.set(row.activityId, (pending.get(row.activityId) ?? 0) + 1);
    return (feed.data?.items ?? [])
      .filter((item) => !item.cancelled && (item.isHost || item.myStatus === "accepted" || item.myStatus === "pending"))
      .map((item) => ({ item, kind: (item.isHost ? "host" : item.myStatus === "accepted" ? "accepted" : "pending") as Kind, day: berlinDay(item.startsAt), open: item.isHost ? pending.get(item.id) ?? 0 : 0 }))
      .sort((a, b) => new Date(a.item.startsAt).getTime() - new Date(b.item.startsAt).getTime());
  }, [feed.data, requests.data]);

  const nowMs = Date.now();
  const upcoming = entries.filter((entry) => new Date(entry.item.startsAt).getTime() + entry.item.durationMin * 60_000 >= nowMs);
  const past = entries.filter((entry) => !upcoming.includes(entry)).reverse();
  const byDay = new Map<string, Entry[]>();
  for (const entry of upcoming) byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
  const busyDays = new Set(upcoming.map((entry) => entry.day));
  const weekDays = Array.from({ length: 7 }, (_, index) => shift(week, index));

  function jump(day: string) {
    setPicked(day);
    const target = [...byDay.keys()].find((key) => key >= day);
    if (!target) return;
    document.getElementById(`tag-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const loading = feed.loading && !feed.data;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl leading-none">{t("Meine Termine")}</h1>
        <p className="mt-2 text-sm text-muted">{t("Was du veranstaltest, zugesagt oder angefragt hast.")}</p>
        <div className="mt-3"><CalendarSubscribe /></div>
      </div>

      <div className="card space-y-2 p-3">
        <div className="flex items-center justify-between">
          <button type="button" aria-label={t("Woche zurück")} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand-deep" onClick={() => setWeek(shift(week, -7))}><ChevronLeft className="h-5 w-5" /></button>
          <p className="text-sm font-semibold">{fmt(week, { day: "numeric", month: "short" })} – {fmt(shift(week, 6), { day: "numeric", month: "short" })}</p>
          <button type="button" aria-label={t("Woche vor")} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand-deep" onClick={() => setWeek(shift(week, 7))}><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const isToday = day === today;
            const active = picked === day;
            return (
              <button key={day} type="button" onClick={() => jump(day)} aria-label={`${dayTitle(day, today)}${busyDays.has(day) ? `, ${t("mit Termin")}` : ""}`} className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-control text-xs ${active ? "bg-ink text-onaccent" : isToday ? "bg-accent/15 text-accent-deep" : "text-ink"}`}>
                <span className="font-medium opacity-80">{fmt(day, { weekday: "short" }).replace(".", "")}</span>
                <span className="text-base font-semibold">{fmt(day, { day: "numeric" })}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${busyDays.has(day) ? (active ? "bg-onaccent" : "bg-accent") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <div className="card h-40 animate-pulse bg-sand-deep" /> : null}
      {feed.error ? <Note>{feed.error}</Note> : null}

      {!loading && upcoming.length === 0 ? (
        <Empty
          art="calendar"
          title={t("Noch keine Termine")}
          body={t("Sobald du zusagst, anfragst oder selbst etwas anlegst, steht es hier.")}
          action={<Link to="/" className="inline-flex h-12 w-full items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill">{t("Treffen entdecken")}</Link>}
        />
      ) : null}

      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} id={`tag-${day}`} className="scroll-mt-20 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{dayTitle(day, today)}</h2>
          <div className="space-y-2">{list.map((entry) => <Row key={entry.item.id} entry={entry} />)}</div>
        </section>
      ))}

      {past.length ? (
        <section className="space-y-2">
          <button type="button" aria-expanded={pastOpen} onClick={() => setPastOpen((value) => !value)} className="flex h-11 w-full items-center justify-between rounded-control px-1 text-sm font-semibold text-muted">
            {t("Meine bisherigen Treffen · {0}", past.length)}
            <ChevronDown className={`h-5 w-5 transition-transform ${pastOpen ? "rotate-180" : ""}`} />
          </button>
          {pastOpen ? <div className="space-y-2">{past.map((entry) => <PastRow key={entry.item.id} entry={entry} />)}</div> : null}
        </section>
      ) : null}
    </div>
  );
}

/** History row with a souvenir ticket. Tickets exist only here, for meetups that already happened. */
function PastRow({ entry }: { entry: Entry }) {
  const [busy, setBusy] = useState(false);
  const went = entry.kind === "host" || entry.kind === "accepted";
  async function ticket() {
    setBusy(true);
    try {
      const when = new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(entry.item.startsAt));
      const blob = await drawTicket({ title: entry.item.title, when, place: `${entry.item.placeName}${entry.item.city ? `, ${entry.item.city}` : ""}`, label: entry.kind === "host" ? t("Eingeladen von mir") : t("Ich war dabei"), footer: t("Erinnerung, kein Eintritt") });
      await saveOrShare(blob, `meeqo-${entry.day}.png`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1.5 opacity-90">
      <Row entry={entry} showDay />
      {went ? <button type="button" disabled={busy} onClick={() => void ticket()} className="ml-auto flex h-9 items-center gap-1.5 rounded-control px-3 text-xs font-semibold text-accent-deep underline">{busy ? t("Einen Moment…") : t("Ticket speichern")}</button> : null}
    </div>
  );
}

function Row({ entry, showDay = false }: { entry: Entry; showDay?: boolean }) {
  const chip = CHIP[entry.kind];
  return (
    <Link to="/activity/$id" params={{ id: entry.item.id }} className="card flex items-center gap-3 p-3">
      <div className="w-14 shrink-0 text-center">
        <p className="text-base font-semibold">{timeOf(entry.item.startsAt)}</p>
        {showDay ? <p className="text-[11px] text-muted">{fmt(entry.day, { day: "numeric", month: "short" })}</p> : <p className="text-[11px] text-muted">{t("{0} Min.", entry.item.durationMin)}</p>}
      </div>
      <div className="min-w-0 flex-1 border-l border-line pl-3">
        <p className="truncate font-semibold">{entry.item.title}</p>
        <p className="truncate text-sm text-muted">{entry.item.placeName}{entry.item.city ? `, ${entry.item.city}` : ""}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-bold ${chip.className}`}>{t(chip.label)}</span>
          {entry.open > 0 ? <span className="inline-flex h-6 items-center rounded-md bg-accent px-2 text-[11px] font-bold text-onfill">{entry.open === 1 ? t("1 offene Anfrage") : t("{0} offene Anfragen", entry.open)}</span> : null}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
