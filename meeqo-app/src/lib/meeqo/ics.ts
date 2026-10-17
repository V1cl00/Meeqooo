/** Calendar files for meetups. Pure, so they can be tested without a browser. */
type IcsItem = { id: string; title: string; description: string; startsAt: string; placeName: string; city: string; durationMin?: number };

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/[;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, "\\n");

function eventLines(item: IcsItem, now: Date) {
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + (item.durationMin ?? 120) * 60 * 1000);
  return [
    "BEGIN:VEVENT",
    `UID:${item.id}@meeqo`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(item.title)}`,
    `LOCATION:${escape(`${item.placeName}, ${item.city}`)}`,
    `DESCRIPTION:${escape(item.description.slice(0, 300))}`,
    "END:VEVENT",
  ];
}

export function icsFor(item: IcsItem, now = new Date()) {
  return icsCalendar([item], undefined, now);
}

/** One subscribable calendar with all given meetups. */
export function icsCalendar(items: IcsItem[], name?: string, now = new Date()) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeeQo//DE",
    ...(name ? [`X-WR-CALNAME:${escape(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H"] : []),
    ...items.flatMap((item) => eventLines(item, now)),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function mapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

/** Directions from wherever the phone is to the meeting point. */
export function routeUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}
