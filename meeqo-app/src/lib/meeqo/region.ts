import { kmBetween } from "./geo.ts";

/** Where MeeQo starts: Karlsruhe and everything within 100 km. Outside it people can still join; they are told it is quiet there. */
export const LAUNCH = { name: "Karlsruhe", lat: 49.0069, lng: 8.4037, km: 100 } as const;

export function inLaunchRegion(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  return kmBetween(LAUNCH.lat, LAUNCH.lng, lat, lng) <= LAUNCH.km;
}
