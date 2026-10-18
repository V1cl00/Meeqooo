/** Calendar files for meetups. Pure, so they can be tested without a browser. */
export type IcsItem = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  placeName: string;
  city: string;
  durationMin?: number;
  /** confirmed (default), tentative (request still open) or cancelled. */
  status?: "confirmed" | "tentative" | "cancelled";
  url?: string;
  /** Last change; raises SEQUENCE so calendar apps take the update. */
  updatedAt?: string;
};

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export const icsEscape = (text: string) => text.replace(/\\/g, "\\\\").replace(/[;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, "\\n");

/** RFC 5545: lines longer than 75 octets continue on the next line after a space. */
export function fold(line: string) {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (bytes.encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const BERLIN = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function eventLines(item: IcsItem, now: Date) {
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + (item.durationMin ?? 120) * 60 * 1000);
  const status = item.status === "cancelled" ? "CANCELLED" : item.status === "tentative" ? "TENTATIVE" : "CONFIRMED";
  const place = [item.placeName, item.city].filter(Boolean).join(", ");
  const sequence = item.updatedAt ? Math.max(0, Math.floor(new Date(item.updatedAt).getTime() / 1000) - 1_700_000_000) : 0;
  return [
    "BEGIN:VEVENT",
    `UID:${item.id}@meeqo`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    `SUMMARY:${icsEscape(item.status === "cancelled" ? `Abgesagt: ${item.title}` : item.title)}`,
    ...(place ? [`LOCATION:${icsEscape(place)}`] : []),
    ...(item.description ? [`DESCRIPTION:${icsEscape(item.description.slice(0, 300))}`] : []),
    ...(item.url ? [`URL:${item.url}`] : []),
    "END:VEVENT",
  ];
}

export function icsFor(item: IcsItem, now = new Date()) {
  return icsCalendar([item], undefined, now);
}

/** One subscribable calendar with all given meetups. Times are UTC; the calendar names Europe/Berlin as its zone. */
export function icsCalendar(items: IcsItem[], name?: string, now = new Date()) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeeQo//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(name ? [`X-WR-CALNAME:${icsEscape(name)}`, "X-WR-TIMEZONE:Europe/Berlin", "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"] : []),
    ...BERLIN,
    ...items.flatMap((item) => eventLines(item, now)),
    "END:VCALENDAR",
    "",
  ].map(fold).join("\r\n");
}

/** Google Calendar "add event" page, for the single-event button on Android. */
export function googleTemplateUrl(item: IcsItem) {
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + (item.durationMin ?? 120) * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    ctz: "Europe/Berlin",
    location: [item.placeName, item.city].filter(Boolean).join(", "),
    details: [item.description.slice(0, 300), item.url].filter(Boolean).join("\n\n"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Subscribe links: webcal for Apple, Google's "add by URL" for Android. */
export function subscribeUrls(origin: string, path: string) {
  const host = origin.replace(/^https?:\/\//, "");
  const webcal = `webcal://${host}${path}`;
  return { https: `${origin}${path}`, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}

export function mapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

/** Directions from wherever the phone is to the meeting point. */
export function routeUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}
