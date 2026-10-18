/** Turns one sentence into form fields. Plain rules, no network, so it works offline and can be tested. */
export type ParsedMeetup = {
  title: string;
  category: string;
  /** datetime-local value, or "" when the sentence names neither day nor time */
  when: string;
  spots: number | null;
  placeName: string;
  durationMin: number | null;
};

const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const WEEKDAYS: Record<string, number> = {
  sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const MONTHS = ["januar", "februar", "märz", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember", "january", "february", "march", "may", "june", "july", "october", "december"];

const CATEGORIES: [RegExp, string][] = [
  [/\b(bouldern|klettern|boulder|bouldering|climbing)\b/i, "Sport · Klettern"],
  [/\b(laufen|joggen|lauftreff|laufrunde|running|jogging|run)\b/i, "Sport · Laufen"],
  [/\bcalisthenics\b/i, "Sport · Calisthenics"],
  [/\byoga\b/i, "Sport · Yoga"],
  [/\b(schwimmen|swimming)\b/i, "Sport · Schwimmen"],
  [/\b(radfahren|radtour|fahrradtour)\b/i, "Sport · Radfahren"],
  [/\b(fußball|fussball|volleyball|basketball|tischtennis)\b/i, "Sport · Ballsport"],
  [/\btanzen\b/i, "Sport · Tanzen"],
  [/\b(wandern|hiking|hike)\b/i, "Outdoor · Wandern"],
  [/\b(spazieren|spaziergang|walk|stroll)\b/i, "Outdoor · Spaziergang"],
  [/\bpicknick\b/i, "Essen · Picknick"],
  [/\b(brunch|frühstück|fruehstueck|breakfast)\b/i, "Essen · Brunch"],
  [/\b(kochen|cooking)\b/i, "Essen · Kochen"],
  [/\bbacken\b/i, "Essen · Backen"],
  [/\b(kaffee|café|cafe|coffee)\b/i, "Essen · Kaffee"],
  [/\b(restaurant|abendessen|mittagessen|essen|dinner|lunch)\b/i, "Essen · Restaurant"],
  [/\b(brettspiel|brettspiele|spieleabend|board games?|game night)\b/i, "Spiele · Brettspiele"],
  [/\bschach\b/i, "Spiele · Schach"],
  [/\bquiz\b/i, "Spiele · Quiz"],
  [/\b(kino|cinema|movies?)\b/i, "Kultur · Kino"],
  [/\bmuseum\b/i, "Kultur · Museum"],
  [/\b(konzert|concert)\b/i, "Kultur · Konzert"],
  [/\bkaraoke\b/i, "Musik · Karaoke"],
  [/\b(sauna|spa)\b/i, "Wellness · Sauna"],
  [/\b(netzwerken|networking)\b/i, "Business · Netzwerken"],
  [/\bafterwork\b/i, "Business · Afterwork"],
  [/\bcoworking\b/i, "Business · Coworking"],
  [/\b(gassi|hunderunde|dog walk)\b/i, "Tiere · Gassi"],
];

function berlinToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), minutes: get("hour") * 60 + get("minute") };
}

function dateString(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toISOString().slice(0, 10);
}

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseMeetup(input: string, now = new Date()): ParsedMeetup {
  let rest = input.replace(/\s+/g, " ").trim();
  const today = berlinToday(now);
  const todayDow = new Date(Date.UTC(today.y, today.m - 1, today.d, 12)).getUTCDay();
  const remove = (pattern: RegExp) => {
    rest = rest.replace(pattern, " ");
  };

  // time
  let minutes: number | null = null;
  // "18:30", "18.30 Uhr" or "18 Uhr". A bare "24.10" is a date, not a time.
  const ampm = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(rest);
  if (ampm && Number(ampm[1]) >= 1 && Number(ampm[1]) <= 12) {
    minutes = (Number(ampm[1]) % 12 + (ampm[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + Number(ampm[2] ?? 0);
    remove(new RegExp(escapeRe(ampm[0]), "i"));
  }
  const clock = minutes !== null ? null :
    /\b(?:um\s+|at\s+)?(\d{1,2}):(\d{2})(?:\s*uhr)?\b/i.exec(rest) ??
    /\b(?:um\s+)?(\d{1,2})\.(\d{2})\s*uhr\b/i.exec(rest) ??
    /\b(?:um\s+)?(\d{1,2})\s*uhr\b/i.exec(rest);
  if (clock) {
    const hours = Number(clock[1]);
    const mins = clock[2] ? Number(clock[2]) : 0;
    if (hours < 24 && mins < 60) {
      minutes = hours * 60 + mins;
      remove(new RegExp(escapeRe(clock[0]), "i"));
    }
  }

  // duration
  let durationMin: number | null = null;
  const dur = /\b(\d+(?:[.,]\d)?)\s*(minuten|minutes|min|stunden|stunde|hours|hour|hrs|std|h)\b/i.exec(rest);
  if (dur) {
    const value = Number(dur[1].replace(",", "."));
    durationMin = /^(m)/i.test(dur[2]) ? Math.round(value) : Math.round(value * 60);
    remove(new RegExp(escapeRe(dur[0]), "i"));
  }

  // spots
  let spots: number | null = null;
  const people = /\b(?:(?:für|for)\s+)?(\d{1,2}|ein|eine|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:leute|personen|plätze|plaetze|teilnehmer|menschen|people|persons|spots|guests)\b/i.exec(rest);
  const forN = /\b(?:für|for)\s+(\d{1,2})\b/i.exec(rest);
  const found = people ?? forN;
  if (found) {
    const raw = found[1].toLowerCase();
    spots = /^\d/.test(raw) ? Number(raw) : NUMBER_WORDS[raw] ?? null;
    remove(new RegExp(escapeRe(found[0]), "i"));
  }

  // day
  let date: string | null = null;
  const explicit = /\b(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?(?=\s|,|$)/.exec(rest);
  if (explicit) {
    const month = Number(explicit[2]);
    let year = explicit[3] ? Number(explicit[3]) : today.y;
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12) {
      let candidate = dateString(year, month, Number(explicit[1]));
      if (!explicit[3] && candidate < dateString(today.y, today.m, today.d)) candidate = dateString(year + 1, month, Number(explicit[1]));
      date = candidate;
      remove(new RegExp(`(?:am\\s+)?${escapeRe(explicit[0])}`, "i"));
    }
  }
  if (!date) {
    const word = /\b(?:am\s+|on\s+|next\s+|nächsten\s+|naechsten\s+|kommenden\s+)*(heute|today|morgen|tomorrow|übermorgen|uebermorgen|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(rest);
    if (word) {
      const name = word[1].toLowerCase();
      let offset: number;
      if (name === "heute" || name === "today") offset = 0;
      else if (name === "morgen" || name === "tomorrow") offset = 1;
      else if (name.startsWith("übermorgen") || name.startsWith("uebermorgen")) offset = 2;
      else {
        offset = (WEEKDAYS[name] - todayDow + 7) % 7;
        if (offset === 0 && minutes !== null && minutes <= today.minutes) offset = 7;
      }
      date = dateString(today.y, today.m, today.d + offset);
      remove(new RegExp(escapeRe(word[0]), "i"));
    }
  }
  if (!date && minutes !== null) {
    date = dateString(today.y, today.m, today.d + (minutes > today.minutes ? 0 : 1));
  }
  const when = date ? `${date}T${String(Math.floor((minutes ?? 600) / 60)).padStart(2, "0")}:${String((minutes ?? 600) % 60).padStart(2, "0")}` : "";

  // place: the first capitalised words after a place preposition that are not a day or month
  let placeName = "";
  const notPlace = new Set([...Object.keys(WEEKDAYS), ...MONTHS, "heute", "morgen", "übermorgen", "abend", "nachmittag", "vormittag", "wochenende", "today", "tomorrow", "evening", "afternoon", "morning", "weekend"]);
  const placeRe = /\b(?:am|im|in|bei|beim|an der|an dem|auf dem|vor dem|zum|zur|at the|at|in the|near the|near|by the)\s+([A-ZÄÖÜ][\p{L}\-.]*(?:\s+[A-ZÄÖÜ][\p{L}\-.]*){0,3})/gu;
  for (const match of rest.matchAll(placeRe)) {
    if (!notPlace.has(match[1].toLowerCase())) {
      placeName = match[1].replace(/[.,]$/, "");
      break;
    }
  }

  let category = "";
  for (const [pattern, name] of CATEGORIES) {
    if (pattern.test(input)) {
      category = name;
      break;
    }
  }

  // title: what is left, tidied
  let title = rest
    .replace(/\b(am|um|für|ab|on|at|for)\b(?=\s*(?:,|$))/gi, " ")
    .replace(/^(am|um|für|ab|on|at|for|,)\s+/i, "")
    .replace(/\s*[,;]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  title = title.replace(/^(am|um|für|ab|on|at|for)\s+/i, "").trim();
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
  if (!title && category) title = category.split(" · ")[1] ?? "";

  return { title, category, when, spots, placeName, durationMin };
}
