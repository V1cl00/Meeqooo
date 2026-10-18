/** How a meetup is shared: only the link. Chats build the preview card (photo, title, date) from the OG tags. Pure, so it is unit-tested. */
export type ShareRoute = "native" | "web" | "sheet";

export function shareRoute(opts: { native: boolean; webShare: boolean }): ShareRoute {
  if (opts.native) return "native";
  if (opts.webShare) return "web";
  return "sheet";
}

/** Exactly what goes to the system sheet: the url, nothing else (no title, no extra text, no file). */
export function linkShareData(url: string): { url: string } {
  return { url };
}
