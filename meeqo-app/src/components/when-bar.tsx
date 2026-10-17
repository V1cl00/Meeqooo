import { useRef, useState } from "react";
import { WEEKDAYS, addDays, berlinDay, dayRange, weekdayMon, weekDates } from "@/lib/meeqo/labels";

function monthCells(year: number, month: number) {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const first = `${key}-01`;
  const pad = weekdayMon(first);
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(`${key}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

function monthsFrom(today: string) {
  const end = addDays(today, 62);
  const months: { year: number; month: number }[] = [];
  let cursor = today.slice(0, 7);
  while (cursor <= end.slice(0, 7)) {
    const [year, month] = cursor.split("-").map(Number);
    months.push({ year, month });
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cursor = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }
  return months;
}

function monthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(
    new Date(Date.UTC(year, month - 1, 15, 12)),
  );
}

export function WhenBar({ days, onChange }: { days: string[]; onChange: (days: string[]) => void }) {
  const today = berlinDay();
  const end = addDays(today, 62);
  const [focus, setFocus] = useState(today);
  const week = weekDates(focus);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string[] | null>(null);
  const drag = useRef<{ from: string; moved: boolean } | null>(null);
  const shown = preview ?? days;

  function allowed(day: string) {
    return day >= today && day <= end;
  }

  function choose(next: string[]) {
    const picked = next.filter(allowed);
    if (!picked.length) return;
    onChange(picked);
    setFocus(picked[picked.length - 1]);
  }

  function toggle(day: string) {
    if (!allowed(day)) return;
    if (days.includes(day)) {
      const next = days.filter((item) => item !== day);
      choose(next.length ? next : [day]);
      return;
    }
    choose([...days, day].sort());
  }

  function finish(range: string[]) {
    choose(range);
    setPreview(null);
    drag.current = null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-1.5">
        {week.map((day) => {
          const on = days.includes(day);
          const past = day < today;
          return (
            <button
              key={day}
              type="button"
              disabled={past}
              onClick={() => toggle(day)}
              className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl text-ink ${on ? "bg-accent text-onfill shadow-[0_6px_14px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]" : "border border-line bg-card"} ${past ? "opacity-40" : ""}`}
            >
              <span className="text-[11px] font-semibold">{WEEKDAYS[weekdayMon(day)]}</span>
              <span className="text-sm font-semibold tabular-nums">{Number(day.slice(8))}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Weiter voraus"
          onClick={() => setOpen((value) => !value)}
          className={`grid h-14 w-12 shrink-0 place-items-center rounded-2xl ${open ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2.5" y="3.5" width="15" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {days.length > 1 ? <p className="text-sm text-muted">{days.length} Tage ausgewählt. Ziehen im Kalender markiert eine Woche oder zwei.</p> : null}
      {open ? (
        <div
          className="card space-y-4 p-3"
          onPointerDown={(event) => {
            const day = (event.target as HTMLElement).closest("[data-day]")?.getAttribute("data-day");
            if (!day || !allowed(day)) return;
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            drag.current = { from: day, moved: false };
            setPreview([day]);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const day = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-day]")?.getAttribute("data-day");
            if (!day || !allowed(day)) return;
            if (day !== drag.current.from) drag.current.moved = true;
            setPreview(dayRange(drag.current.from, day).filter(allowed));
          }}
          onPointerUp={() => {
            if (!drag.current) return;
            const { from, moved } = drag.current;
            if (!moved) toggle(from);
            else if (preview?.length) finish(preview);
            setPreview(null);
            drag.current = null;
          }}
        >
          {monthsFrom(today).map(({ year, month }) => (
            <div key={`${year}-${month}`}>
              <p className="mb-2 font-display text-2xl capitalize">{monthTitle(year, month)}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
                {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {monthCells(year, month).map((day, index) => {
                  if (!day) return <span key={`e-${index}`} />;
                  const on = shown.includes(day);
                  const off = !allowed(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      data-day={off ? undefined : day}
                      disabled={off}
                      className={`flex h-11 items-center justify-center rounded-xl border-2 text-sm font-semibold tabular-nums ${on ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"} ${off ? "opacity-30" : ""}`}
                    >
                      {Number(day.slice(8))}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
