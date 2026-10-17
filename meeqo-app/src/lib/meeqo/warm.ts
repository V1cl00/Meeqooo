import { getFeed, getProfile } from "@/lib/meeqo/api";
import { berlinDay } from "@/lib/meeqo/labels";
import type { FeedResult, Profile } from "@/lib/meeqo/types";

/**
 * Cold start used to be a chain: session, then profile, then feed. The server functions check the
 * cookie themselves, so profile and the default feed can start right when the script loads, in
 * parallel with the session check. Each warm result is used once; a failed warm-up falls back to a
 * normal request.
 */
const FRESH_MS = 15_000;
let profileWarm: { at: number; promise: Promise<Profile> } | null = null;
let feedWarm: { at: number; key: string; promise: Promise<FeedResult> } | null = null;

function feedKey(filter: string, sub: string, days: string[]) {
  return `${filter}|${sub}|${days.join(",")}`;
}

export function warmStart() {
  if (typeof window === "undefined" || window.location.pathname !== "/") return;
  const profile = getProfile();
  profile.catch(() => {});
  profileWarm = { at: Date.now(), promise: profile };
  const days = [berlinDay()];
  const feed = getFeed({ data: { filter: "all", sub: "", days } });
  feed.catch(() => {});
  feedWarm = { at: Date.now(), key: feedKey("all", "", days), promise: feed };
}

export function takeProfile(): Promise<Profile> {
  const warm = profileWarm;
  profileWarm = null;
  return warm && Date.now() - warm.at < FRESH_MS ? warm.promise : getProfile();
}

export function takeFeed(filter: string, sub: string, days: string[]): Promise<FeedResult> {
  const warm = feedWarm;
  feedWarm = null;
  if (warm && Date.now() - warm.at < FRESH_MS && warm.key === feedKey(filter, sub, days)) return warm.promise;
  return getFeed({ data: { filter, sub, days } });
}
