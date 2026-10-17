/** A calendar file for one meetup. Pure, so it can be tested without a browser. */
export function icsFor(item: { id: string; title: string; description: string; startsAt: string; placeName: string; city: string }, now = new Date()) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/[;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, "\\n");
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeeQo//DE",
    "BEGIN:VEVENT",
    `UID:${item.id}@meeqo`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(item.title)}`,
    `LOCATION:${escape(`${item.placeName}, ${item.city}`)}`,
    `DESCRIPTION:${escape(item.description.slice(0, 300))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function mapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
