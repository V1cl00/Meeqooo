/**
 * Rule-based helpers for the feed. No model, no keys, nothing leaves the device:
 * mood sorting, three picks for the week, the time slider and the on-site group sign.
 */

export type Mood = "" | "ruhig" | "aktiv" | "neu";

const CALM = ["Essen", "Kultur", "Spiele", "Wellness", "Kreativ", "Lernen", "Tiere"];
const ACTIVE = ["Sport", "Outdoor", "Musik"];
const ACTIVE_SUBS = ["Tanzen", "Laufen", "Klettern", "Radfahren", "Wandern", "Radtour", "Schwimmen", "Ballsport", "Krafttraining", "Calisthenics", "Kampfsport", "Karaoke"];
const CALM_SUBS = ["Yoga", "Meditation", "Spaziergang", "Kaffee", "Lesen", "Picknick", "Brettspiele", "Sauna"];

type Item = { id: string; category: string; startsAt: string; spotsLeft: number; isHost: boolean; myStatus: string | null; cancelled: boolean; matchesInterest: boolean; friendsGoing: unknown[]; km: number | null; title: string };

const parentOf = (category: string) => category.split(" · ")[0];
const subOf = (category: string) => category.split(" · ").pop() ?? category;

/** 2 = fits the mood well, 1 = somewhat, 0 = not. */
export function moodFit(category: string, mood: Mood, seeking: string[] = []) {
  if (!mood) return 0;
  const parent = parentOf(category);
  const sub = subOf(category);
  if (mood === "neu") {
    const known = seeking.some((item) => item === category || parentOf(item) === parent || subOf(item) === sub);
    return known ? 0 : 2;
  }
  if (mood === "aktiv") return ACTIVE_SUBS.includes(sub) ? 2 : ACTIVE.includes(parent) && !CALM_SUBS.includes(sub) ? 1 : 0;
  return CALM_SUBS.includes(sub) ? 2 : CALM.includes(parent) && !ACTIVE_SUBS.includes(sub) ? 1 : 0;
}

/** Stable sort: better mood fit first, otherwise the server order stays. */
export function sortByMood<T extends { category: string }>(items: T[], mood: Mood, seeking: string[] = []) {
  if (!mood) return items;
  return items.map((item, index) => ({ item, index, fit: moodFit(item.category, mood, seeking) })).sort((a, b) => b.fit - a.fit || a.index - b.index).map((entry) => entry.item);
}

export type Pick<T> = { item: T; reason: "interest" | "friends" | "mood" | "near" | "soon" };

/** Three picks for the next seven days, at most one per main category. Only open meetups someone else hosts. */
export function weekPicks<T extends Item>(items: T[], mood: Mood, seeking: string[], now = Date.now()): Pick<T>[] {
  const week = now + 7 * 86_400_000;
  const scored = items
    .filter((item) => !item.isHost && !item.myStatus && !item.cancelled && item.spotsLeft > 0)
    .filter((item) => { const at = new Date(item.startsAt).getTime(); return at > now && at < week; })
    .map((item) => {
      const fit = moodFit(item.category, mood, seeking);
      const near = item.km != null && item.km <= 3;
      const score = (item.matchesInterest ? 3 : 0) + (item.friendsGoing.length ? 3 : 0) + fit * 1.5 + (near ? 1 : 0);
      const reason: Pick<T>["reason"] = item.friendsGoing.length ? "friends" : item.matchesInterest ? "interest" : fit ? "mood" : near ? "near" : "soon";
      return { item, score, reason };
    })
    .sort((a, b) => b.score - a.score || new Date(a.item.startsAt).getTime() - new Date(b.item.startsAt).getTime());
  const out: Pick<T>[] = [];
  const used = new Set<string>();
  for (const entry of scored) {
    const parent = parentOf(entry.item.category);
    if (used.has(parent)) continue;
    used.add(parent);
    out.push({ item: entry.item, reason: entry.reason });
    if (out.length === 3) break;
  }
  return out;
}

/** Time slider stops for today: hours from now, ending at "heute Abend" (23:59 Berlin is close enough to local midnight). */
export function sliderStops(now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 0, 0);
  const left = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 3_600_000));
  return Math.min(left, 18);
}

/** Keeps items that start before now + hours (running ones too). hours >= stops means "the whole evening". */
export function withinHours<T extends { startsAt: string }>(items: T[], hours: number, stops: number, now = Date.now()) {
  if (hours >= stops) return items;
  const limit = now + hours * 3_600_000;
  return items.filter((item) => new Date(item.startsAt).getTime() <= limit);
}

const COLORS = [
  { key: "Terrakotta", hex: "#E07A5F" },
  { key: "Grün", hex: "#81B29A" },
  { key: "Anthrazit", hex: "#3D405B" },
  { key: "Gelb", hex: "#F2CC8F" },
] as const;
const SHAPES = ["Kreis", "Dreieck", "Quadrat", "Raute"] as const;

/** Same sign for everyone in the group, different for neighbouring meetups. Derived from the id only. */
export function groupSign(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { color: COLORS[hash % COLORS.length], shape: SHAPES[Math.floor(hash / COLORS.length) % SHAPES.length] };
}
