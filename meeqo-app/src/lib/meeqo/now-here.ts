/** "Jetzt & hier": what starts within the next hours, or is running and still joinable, close by. */
export const NOW_HOURS = 3;
export const NOW_KM = 2;
export const NOW_WIDE_KM = 5;

export type NowHereItem = { startsAt: string; durationMin: number; km: number | null; spotsLeft: number; cancelled: boolean };

/** Pure on purpose (unit-tested). km null means no distance known: then only time counts when the person has no location. */
export function isNowHere(item: NowHereItem, nowMs: number, opts: { hours?: number; km?: number; hasOrigin?: boolean } = {}) {
  const hours = opts.hours ?? NOW_HOURS;
  const maxKm = opts.km ?? NOW_KM;
  if (item.cancelled) return false;
  const start = new Date(item.startsAt).getTime();
  if (Number.isNaN(start)) return false;
  const end = start + Math.max(1, item.durationMin || 120) * 60_000;
  const upcoming = start >= nowMs && start <= nowMs + hours * 3_600_000;
  const running = start < nowMs && end > nowMs && item.spotsLeft > 0;
  if (!upcoming && !running) return false;
  if (opts.hasOrigin === false) return true;
  return item.km != null && item.km <= maxKm;
}
