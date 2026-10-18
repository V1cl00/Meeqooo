/** Opens directions in the phone's own maps app. No map SDK, no key: plain links. */
export type MapsPlatform = "android" | "ios" | "desktop";
export type MapsTarget = { lat?: number | null; lng?: number | null; label?: string; address?: string };

/** Capacitor platform first ("android" | "ios" | "web"), then the browser's user agent. */
export function mapsPlatform(native: "android" | "ios" | "web", ua: string): MapsPlatform {
  if (native === "android" || native === "ios") return native;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function hasPoint(target: MapsTarget): target is MapsTarget & { lat: number; lng: number } {
  return typeof target.lat === "number" && typeof target.lng === "number" && Number.isFinite(target.lat) && Number.isFinite(target.lng) && !(target.lat === 0 && target.lng === 0);
}

/**
 * Directions link for the platform. Android in the app uses geo: (opens Google Maps or the chosen maps app);
 * Android in the browser uses the Google Maps directions URL, which Chrome hands to the app.
 * Without coordinates the address (or label) is used as a search.
 */
export function directionsUrl(target: MapsTarget, platform: MapsPlatform, inApp = false) {
  const label = (target.label ?? "").trim();
  const query = [target.address, label].map((part) => (part ?? "").trim()).find(Boolean) ?? "";
  if (hasPoint(target)) {
    const point = `${target.lat},${target.lng}`;
    if (platform === "ios") return `https://maps.apple.com/?daddr=${point}${label ? `&q=${encodeURIComponent(label)}` : ""}`;
    if (platform === "android" && inApp) return `geo:${point}?q=${point}${label ? `(${encodeURIComponent(label)})` : ""}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${point}`;
  }
  if (platform === "ios") return `https://maps.apple.com/?daddr=${encodeURIComponent(query)}`;
  if (platform === "android" && inApp) return `geo:0,0?q=${encodeURIComponent(query)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
