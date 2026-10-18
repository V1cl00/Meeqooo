/** Which notification goes out on which channel. Pure, so it is unit-tested. */
export type NotifyType = {
  key: string;
  group: string;
  title: string;
  when: string;
  kinds: string[];
  push: boolean;
  /** Arrives in the quiet hours too. */
  urgent?: boolean;
};

export const NOTIFY_GROUPS = ["Deine Treffen", "Als Host", "Entdecken", "Nach dem Treffen"] as const;

export const NOTIFY_TYPES: NotifyType[] = [
  { key: "answer", group: "Deine Treffen", title: "Anfrage angenommen oder abgelehnt", when: "Sobald der Host entscheidet. Einmal pro Anfrage.", kinds: ["accepted", "declined", "waitlist", "pending"], push: true },
  { key: "reminder", group: "Deine Treffen", title: "Erinnerung", when: "2 Stunden vorher, einmal pro Treffen. Am Vortag fragen wir kurz, ob du kommst.", kinds: ["reminder", "confirm", "checkin"], push: true },
  { key: "change", group: "Deine Treffen", title: "Änderung oder Absage", when: "Sofort, wenn sich Zeit oder Ort ändert oder das Treffen abgesagt wird. Kommt auch in den Ruhezeiten.", kinds: ["changed", "cancelled", "removed"], push: true, urgent: true },
  { key: "chat", group: "Deine Treffen", title: "Neue Nachricht im Gruppenchat", when: "Eine Mitteilung pro Chat, weitere Nachrichten fassen wir darin zusammen.", kinds: ["message", "poll", "ride", "group"], push: true },
  { key: "request", group: "Als Host", title: "Neue Anfrage", when: "Sobald jemand dein Treffen anfragt.", kinds: ["request"], push: true },
  { key: "withdrawn", group: "Als Host", title: "Jemand sagt ab", when: "Sofort, wenn eine Person absagt oder die Warteliste verlässt.", kinds: ["withdrawn"], push: true },
  { key: "minsize", group: "Als Host", title: "Mindestgröße erreicht", when: "Einmal, wenn genug Leute zugesagt haben und das Treffen stattfindet.", kinds: ["minsize"], push: true },
  { key: "nearby", group: "Entdecken", title: "Freie Plätze in deiner Nähe", when: "Höchstens 1× am Tag, nur passend zu deinen Interessen.", kinds: ["nearby", "wish"], push: true },
  { key: "free", group: "Entdecken", title: "Zeitsignal von Freunden", when: "Wenn ein Freund „Ich hab Zeit“ setzt. Höchstens 3× am Tag pro Freund.", kinds: ["free"], push: true },
  { key: "week", group: "Entdecken", title: "Wochen-Story am Sonntag", when: "Sonntags einmal: deine Woche in echten Zahlen.", kinds: ["week"], push: true },
  { key: "after", group: "Nach dem Treffen", title: "Wie war's?", when: "Einmal, etwa 30 Minuten nach dem Ende.", kinds: ["after", "rate"], push: true },
  { key: "thanks", group: "Nach dem Treffen", title: "Danke erhalten", when: "Wenn sich jemand nach dem Treffen bei dir bedankt.", kinds: ["thanks"], push: true },
];

/** Saved push choice per type. Older rows may still carry an "email" key; it is ignored. */
export type ChannelPrefs = Record<string, { push?: boolean; email?: boolean }>;
export type Quiet = { on: boolean; from: number; to: number };

export function typeOfKind(kind: string) {
  return NOTIFY_TYPES.find((type) => type.kinds.includes(kind)) ?? null;
}

export function parsePrefs(raw: unknown): ChannelPrefs {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    return value && typeof value === "object" ? (value as ChannelPrefs) : {};
  } catch {
    return {};
  }
}

/** Effective push setting of one row: saved choice, else the default. */
export function channelValue(type: NotifyType, prefs: ChannelPrefs) {
  const saved = prefs[type.key]?.push;
  return typeof saved === "boolean" ? saved : type.push;
}

/** 22–8: from 22:00 to 07:59. from === to means no quiet time. */
export function inQuiet(hour: number, quiet: Quiet) {
  if (!quiet.on || quiet.from === quiet.to) return false;
  return quiet.from < quiet.to ? hour >= quiet.from && hour < quiet.to : hour >= quiet.from || hour < quiet.to;
}

export function berlinHour(date: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(date));
}

/**
 * Notifications go out as push only; MeeQo sends no notification e-mails (account mails such as login links are separate).
 * Quiet hours hold back push, never urgent changes; the in-app list always gets it.
 */
export function channelsFor(kind: string, prefs: ChannelPrefs, opts: { quiet: Quiet; hour: number }) {
  const type = typeOfKind(kind);
  const quiet = inQuiet(opts.hour, opts.quiet);
  if (!type) return { push: !quiet, email: false as const };
  return { push: channelValue(type, prefs) && (type.urgent || !quiet), email: false as const };
}
