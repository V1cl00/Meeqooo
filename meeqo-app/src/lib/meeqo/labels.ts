export const CATEGORY_TREE = [
  { name: "Sport", subs: ["Laufen", "Calisthenics", "Klettern", "Radfahren", "Krafttraining", "Yoga", "Schwimmen", "Ballsport", "Kampfsport", "Tanzen"] },
  { name: "Essen", subs: ["Brunch", "Kochen", "Restaurant", "Kaffee", "Picknick", "Backen", "Streetfood"] },
  { name: "Outdoor", subs: ["Spaziergang", "Wandern", "Radtour", "Stadtbummel", "Baden", "Picknick"] },
  { name: "Kultur", subs: ["Museum", "Kino", "Theater", "Ausstellung", "Lesen", "Konzert"] },
  { name: "Spiele", subs: ["Brettspiele", "Kartenspiele", "Videospiele", "Quiz", "Schach"] },
  { name: "Wellness", subs: ["Sauna", "Therme", "Yoga", "Meditation", "Spa"] },
  { name: "Musik", subs: ["Konzert", "Jamsession", "Karaoke", "Offenes Singen"] },
  { name: "Kreativ", subs: ["Malen", "Fotografie", "Töpfern", "Schreiben", "Handwerk"] },
  { name: "Lernen", subs: ["Sprache", "Workshop", "Studium"] },
  { name: "Tiere", subs: ["Hunde", "Gassi", "Reiten"] },
  { name: "Business", subs: ["Netzwerken", "Coworking", "Afterwork", "Gründung", "Mentoring", "Frühstück", "Vortrag"] },
] as const;

export const CATEGORIES: string[] = CATEGORY_TREE.map((item) => item.name);

export type CustomCategory = { id: string; name: string; parent: string };

export function splitCategory(value: string) {
  const mark = value.indexOf(" · ");
  if (mark === -1) return { parent: value, sub: "" };
  return { parent: value.slice(0, mark), sub: value.slice(mark + 3) };
}

export function joinCategory(parent: string, sub: string) {
  return sub ? `${parent} · ${sub}` : parent;
}

export type Sparte = "business" | "event" | "meetup";

/** Business and Veranstaltungen are not ordinary meetups; the UI frames them differently. */
export function sparteOf(category: string, organizer: boolean): { kind: Sparte; sub: string } {
  const { parent, sub } = splitCategory(category);
  if (parent === "Business") return { kind: "business", sub };
  if (organizer) return { kind: "event", sub: parent === "Veranstaltungen" ? sub : parent };
  return { kind: "meetup", sub };
}

export function categoryMatches(stored: string, selected: string) {
  if (!selected) return true;
  const item = stored.trim().toLowerCase();
  const want = selected.trim().toLowerCase();
  return item === want || item.startsWith(`${want} · `) || item.endsWith(` · ${want}`);
}

export function categoryShort(value: string) {
  const { sub, parent } = splitCategory(value);
  return sub || parent;
}

export function subsFor(parent: string, custom: CustomCategory[] = []) {
  const built: string[] = [...(CATEGORY_TREE.find((item) => item.name === parent)?.subs ?? [])];
  const own = custom.filter((item) => item.parent === parent).map((item) => item.name);
  return [...built, ...own.filter((name) => !built.includes(name))];
}

export const MORE_SUGGESTIONS = [
  { parent: "Sport", name: "Bouldern" },
  { parent: "Sport", name: "Tennis" },
  { parent: "Essen", name: "Wein" },
  { parent: "Essen", name: "Fine Dining" },
  { parent: "Outdoor", name: "Kajak" },
  { parent: "Kultur", name: "Lesung" },
  { parent: "Business", name: "Pitch" },
  { parent: "Business", name: "Messe" },
  { parent: "Kreativ", name: "Nähen" },
  { parent: "Musik", name: "Open Mic" },
] as const;

export const TRAITS = [
  "Vegan",
  "Vegetarisch",
  "Queer",
  "Queerfreundlich",
  "Alkoholfrei",
  "Barrierearm",
  "Anfänger",
  "Hunde willkommen",
  "Rauchen nein",
  "Familienfreundlich",
  "Draußen",
] as const;

export const CLASSIFIED_CATS = ["Verkaufen", "Suchen", "Tauschen", "Verschenken", "Mitfahrgelegenheit"] as const;

export const PROMOTE_AT = 3;

export function lensSubs(lens: string) {
  if (lens === "essen") return [...(CATEGORY_TREE.find((item) => item.name === "Essen")?.subs ?? [])];
  if (lens === "business") return [...(CATEGORY_TREE.find((item) => item.name === "Business")?.subs ?? [])];
  if (lens === "classifieds") return [...CLASSIFIED_CATS];
  if (lens === "events" || lens === "date" || lens === "friends") return [...CATEGORIES];
  return [];
}

export const AREAS = [
  { id: "dating", title: "Dating", hint: "Treffen, die von Anfang an ein Date sind." },
  { id: "friends", title: "Freunde", hint: "Gemeinsame Zeit, ohne Dating." },
  { id: "business", title: "Business", hint: "Netzwerken, Afterwork, Gründung." },
  { id: "classifieds", title: "Kleinanzeigen", hint: "Etwas suchen, verkaufen oder tauschen." },
] as const;

const AREA_IDS = AREAS.map((item) => item.id);

export function cleanAreas(value: unknown) {
  const list = Array.isArray(value) ? value : [];
  const picked = new Set(list.filter((item): item is string => typeof item === "string"));
  return AREA_IDS.filter((id) => picked.has(id));
}

export function areasFromOpen(openTo: string) {
  if (openTo === "both") return ["dating", "friends"];
  if (openTo === "dating") return ["dating"];
  if (openTo === "friends") return ["friends"];
  return [];
}

export function openFromAreas(areas: string[]) {
  const dating = areas.includes("dating");
  const friends = areas.includes("friends");
  if (dating && friends) return "both";
  if (dating) return "dating";
  if (friends) return "friends";
  return "none";
}

export function intentFromAreas(areas: string[]) {
  if (areas.includes("friends") && !areas.includes("dating")) return "friends";
  if (areas.includes("dating")) return "curious";
  return "friends";
}

export function areaSummary(areas: string[]) {
  const titles = AREAS.filter((item) => areas.includes(item.id)).map((item) => item.title);
  return titles.length ? titles.join(" · ") : "Noch nichts gewählt";
}

export function seesByAreas(areas: string[], intent: string, category: string) {
  if (areas.includes("business") && categoryMatches(category, "Business")) return true;
  if (areas.includes("dating") && (intent === "date" || intent === "both")) return true;
  if (areas.includes("friends") && (intent === "friends" || intent === "both")) return true;
  return false;
}

export const INTENTS = [
  {
    id: "serious",
    title: "Etwas Ernstes",
    hint: "Ein Date, bei dem du dir mehr vorstellen kannst.",
    open: "dating",
  },
  {
    id: "curious",
    title: "Mal schauen, was passiert",
    hint: "Offen, ohne festes Ziel. Trotzdem ein Date.",
    open: "dating",
  },
  {
    id: "casual",
    title: "Lockeres Date",
    hint: "Unverbindlich, und von Anfang an als Date erkennbar.",
    open: "dating",
  },
  {
    id: "friends",
    title: "Neue Freunde",
    hint: "Kein Dating. Nur gemeinsame Zeit.",
    open: "friends",
  },
] as const;

export const RADIUS_OPTIONS = [5, 10, 25, 40, 60, 100] as const;

export function intentTitle(id: string) {
  return INTENTS.find((item) => item.id === id)?.title ?? "Absicht fehlt";
}

export function openLabel(openTo: string) {
  if (openTo === "both") return "Dates und Freundschaft";
  if (openTo === "dating") return "Dates";
  if (openTo === "friends") return "Freundschaft";
  return "Absicht offen";
}

export function activityIntentLabel(intent: string) {
  if (intent === "date") return "Date";
  if (intent === "friends") return "Freundschaft";
  if (intent === "both") return "Beides";
  return intentTitle(intent);
}

export function bookingLabel(mode: string) {
  return mode === "instant" ? "Sofortbuchung" : "Anfrage";
}

export function berlinDay(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(key: string, count: number) {
  const [year, month, day] = key.split("-").map(Number);
  return berlinDay(new Date(Date.UTC(year, month - 1, day + count, 12)));
}

export function weekdayMon(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const js = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return (js + 6) % 7;
}

export function weekDates(anchor: string) {
  const start = addDays(anchor, -weekdayMon(anchor));
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function dayRange(from: string, to: string) {
  const [start, end] = from < to ? [from, to] : [to, from];
  const days: string[] = [];
  for (let cursor = start; cursor <= end && days.length < 62; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = pick("weekday").replace(/\.$/, "");
  return `${weekday}., ${pick("day")}. ${pick("month")}, ${pick("hour")}:${pick("minute")}`;
}

export function errText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return "Das hat nicht geklappt.";
}

export function isUnauthorized(error: unknown) {
  return errText(error) === "Unauthorized";
}
