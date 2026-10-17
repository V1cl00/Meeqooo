const BERLIN = "Europe/Berlin";

const wall = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function wallParts(date: Date) {
  const get = (type: string) => Number(wall.formatToParts(date).find((part) => part.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** Minutes Berlin is ahead of UTC at this instant: 60 in winter, 120 in summer. */
function berlinOffset(date: Date) {
  const { y, m, d, h, mi } = wallParts(date);
  const wallAsUtc = Date.UTC(y, m - 1, d, h, mi);
  const real = Math.floor(date.getTime() / 60_000) * 60_000;
  return Math.round((wallAsUtc - real) / 60_000);
}

/**
 * The same wall-clock time `days` later in Berlin. Adding 24 hours per day would move a weekly
 * meetup by an hour across daylight saving, so the date is added on the wall clock instead.
 */
export function addDaysBerlin(iso: string, days: number) {
  const start = new Date(iso);
  const { y, m, d, h, mi } = wallParts(start);
  const target = Date.UTC(y, m - 1, d + days, h, mi);
  let instant = target - berlinOffset(new Date(target)) * 60_000;
  instant = target - berlinOffset(new Date(instant)) * 60_000;
  return new Date(instant).toISOString();
}
