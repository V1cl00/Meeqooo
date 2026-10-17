import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { kmBetween, cityCoords, matchCities } from "@/lib/meeqo/geo";
import { MOODS, REPORT_REASONS } from "@/lib/meeqo/labels";
import { addDaysBerlin } from "@/lib/meeqo/time";
import { fitOf } from "@/lib/meeqo/fit";
import { bump, waitBump } from "@/lib/meeqo/live";
import { lookupPlace, plzChoices, plzPoint, venuesNear } from "@/lib/meeqo/places";
import { categoryMatches, CATEGORIES, CATEGORY_TREE, MORE_SUGGESTIONS, PROMOTE_AT, splitCategory, areasFromOpen, berlinDay, cleanAreas, intentFromAreas, openFromAreas, seesByAreas } from "@/lib/meeqo/labels";
import { localTheme, normalizeTheme } from "@/lib/meeqo/theme";
import type {
  ActivityCard,
  ActivityDetail,
  CategoryHit,
  ChatMessage,
  ChatPerson,
  AdChat,
  CircleMember,
  SafetyView,
  BlockedUser,
  AdminReport,
  AdminStats,
  NextUp,
  PollView,
  RideView,
  VenueHit,
  MyData,
  InviteView,
  ChatThread,
  Classified,
  CommunityCard,
  FeedResult,
  FriendPerson,
  Notice,
  Post,
  Profile,
  PublicProfile,
  RequestItem,
} from "@/lib/meeqo/types";

/**
 * authMiddleware plus: suspended accounts are shut out of every call, not only the ones that load a profile.
 * The flag is cached for 30 seconds per server, so a suspension reaches other servers within that time.
 */
const suspendedCache = new Map<string, { at: number; value: boolean }>();

const memberMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const hit = suspendedCache.get(context.userId);
    let suspended: boolean;
    if (hit && Date.now() - hit.at < 30_000) {
      suspended = hit.value;
    } else {
      const sql = await getSql();
      const rows = await sql<{ suspended: boolean }>`select suspended from profiles where user_id = ${context.userId}`;
      suspended = flag(rows[0]?.suspended);
      suspendedCache.set(context.userId, { at: Date.now(), value: suspended });
    }
    if (suspended) throw new Error("Dein Konto ist gesperrt. Schreib dem Support.");
    return next();
  });

type ProfileRow = {
  suspended?: boolean;
  user_id: string;
  display_name: string;
  bio: string;
  intent: string;
  open_to: string;
  areas: string;
  seeking: string;
  city: string;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  is_organizer: boolean;
  organizer_name: string;
  booking_mode: string;
  identity_confirmed: boolean;
  trusted_label: string;
  onboarding_done: boolean;
  notify_push: boolean;
  age_confirmed_at?: unknown;
  notify_email?: boolean;
  avatar_url: string;
  theme: string;
  traits: string;
  require_traits: string;
  birth_year: number | null;
  default_visibility: string;
  audience_ids: string;
};

type ActRow = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: string;
  intent: string;
  place_name: string;
  city: string;
  lat: number;
  lng: number;
  starts_at: unknown;
  spots: number;
  image_url: string;
  booking_mode: string;
  community_id: string | null;
  public_place: boolean;
  cancelled: boolean;
  area: string;
  duration_min: number | string | null;
  traits: string;
  host_traits: string;
  visibility: string;
  audience_ids: string;
  host_birth_year: number | null;
  display_name: string;
  avatar_url: string;
  is_organizer: boolean;
  identity_confirmed: boolean;
  rating_n: number | string | null;
  again_yes: number | string | null;
  hosted: number | string | null;
  punctual: number | string | null;
  respectful: number | string | null;
  matches: number | string | null;
  taken: number | string | null;
  my_status: string | null;
};

function flag(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return "";
}

function parseList(raw: unknown) {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  return parseSeeking(typeof raw === "string" ? raw : "[]");
}

function covers(have: string[], need: string[]) {
  if (!need.length) return true;
  const set = new Set(have.map((item) => item.toLowerCase()));
  return need.every((item) => set.has(item.toLowerCase()));
}

function parseSeeking(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    /* older rows */
  }
  return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function badgesFrom(
  identity: boolean,
  organizer: boolean,
  count: number,
  punctual: number,
  respectful: number,
  matches: number,
  yes = 0,
  hosted = 0,
) {
  const badges: string[] = [];
  if (count >= 3) badges.push(`${yes} von ${count} wollen wieder`);
  if (identity) badges.push("Profil bestätigt");
  if (organizer) badges.push("Veranstalter");
  if (hosted >= 2) badges.push(`${hosted} Treffen geleitet`);
  if (count >= 1 && punctual >= 4) badges.push("Zuverlässig");
  if (count >= 1 && respectful >= 4) badges.push("Respektvoll");
  if (count >= 1 && matches >= 4) badges.push("Wie im Profil");
  return badges;
}

function assertCategory(value: string) {
  const { parent, sub } = splitCategory(value);
  if (!CATEGORIES.includes(parent)) throw new Error("Kategorie gibt es nicht.");
  if (sub.includes("·")) throw new Error("Unterkategorie ist ungültig.");
  return sub ? `${parent} · ${sub}` : parent;
}

function canSeeActivity(areas: string[], openTo: string, intent: string, category: string) {
  if (areas.length) return seesByAreas(areas, intent, category);
  return visible(openTo, intent);
}

function visible(openTo: string, intent: string) {
  if (!openTo || openTo === "none") return false;
  if (openTo === "both" || intent === "both") return true;
  if (intent === "date") return openTo === "dating";
  if (intent === "friends") return openTo === "friends";
  return false;
}

function passesLens(filter: string, item: ActivityCard) {
  if (filter === "essen") return categoryMatches(item.category, "Essen");
  if (filter === "business") return item.area === "business";
  if (filter === "events") return item.area === "event";
  if (filter === "classifieds") return false;
  return passesFilter(filter, item.intent);
}

function passesFilter(filter: string, intent: string) {
  if (filter === "date") return intent === "date" || intent === "both";
  if (filter === "friends") return intent === "friends" || intent === "both";
  return true;
}

function assertAdult(profile: { ageConfirmed: boolean }) {
  if (!profile.ageConfirmed) throw new Error("Bestätige zuerst, dass du mindestens 18 bist.");
}

/** At most `max` actions of one kind per user in `seconds`. Counts are kept in the database, so they hold across servers. */
async function throttle(sql: Sql, userId: string, kind: string, max: number, seconds: number) {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from rate_events
    where user_id = ${userId} and kind = ${kind} and created_at > now() - (${seconds}::int * interval '1 second')
  `;
  if (num(rows[0]?.n) >= max) throw new Error("Langsam. Das passiert gerade sehr oft. Versuch es in ein paar Minuten nochmal.");
  await sql`insert into rate_events (user_id, kind) values (${userId}, ${kind})`;
  if (Math.random() < 0.02) await sql`delete from rate_events where created_at < now() - interval '2 days'`;
}

/** A real image, not a text that merely starts like one: right type, right magic bytes, sane size. */
function validImage(value: string) {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || value.length > 450_000) return false;
  const head = Buffer.from(match[2].slice(0, 24), "base64");
  return match[1] === "jpeg"
    ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    : head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
}

/**
 * Spots are checked after taking one, not only before: two people answering at the same moment would both
 * pass a plain "is there room" check. If the count went over, this request steps back.
 */
async function overbooked(sql: Sql, activityId: string) {
  const rows = await sql<{ taken: number; spots: number }>`
    select (select count(*)::int from join_requests j where j.activity_id = a.id and j.status = 'accepted') as taken, a.spots
    from activities a where a.id = ${activityId}
  `;
  return num(rows[0]?.taken) > num(rows[0]?.spots);
}

async function blockedWith(sql: Sql, userId: string) {
  const rows = await sql<{ other: string }>`
    select case when blocker_id = ${userId} then blocked_id else blocker_id end as other
    from blocks where blocker_id = ${userId} or blocked_id = ${userId}
  `;
  return new Set(rows.map((row) => row.other));
}

async function ratingStats(sql: Sql, userId: string) {
  const rows = await sql<{ n: number; yes: number; hosted: number; punctual: number | null; respectful: number | null; matches: number | null }>`
    select count(*)::int as n, count(*) filter (where want_again)::int as yes, avg(punctual) as punctual, avg(respectful) as respectful, avg(matches_profile) as matches,
      (select count(*)::int from activities h where h.host_id = ${userId} and h.starts_at < now() and h.cancelled = false) as hosted
    from ratings where ratee_id = ${userId}
  `;
  const row = rows[0];
  return {
    n: num(row?.n),
    yes: num(row?.yes),
    hosted: num(row?.hosted),
    punctual: num(row?.punctual),
    respectful: num(row?.respectful),
    matches: num(row?.matches),
  };
}

function mapProfile(row: ProfileRow, stats: { n: number; yes: number; hosted: number; punctual: number; respectful: number; matches: number }): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    intent: row.intent,
    openTo: row.open_to,
    areas: parseList(row.areas).length ? cleanAreas(parseList(row.areas)) : areasFromOpen(row.open_to),
    seeking: parseSeeking(row.seeking),
    traits: parseList(row.traits),
    requireTraits: parseList(row.require_traits),
    city: row.city,
    lat: row.lat == null ? null : num(row.lat),
    lng: row.lng == null ? null : num(row.lng),
    radiusKm: num(row.radius_km) || 25,
    isOrganizer: flag(row.is_organizer),
    organizerName: row.organizer_name,
    bookingMode: row.booking_mode === "instant" ? "instant" : "request",
    identityConfirmed: flag(row.identity_confirmed),
    trustedLabel: row.trusted_label,
    birthYear: yearOf(row.birth_year),
    defaultVisibility: cleanVisibility(row.default_visibility),
    audienceIds: parseList(row.audience_ids),
    onboardingDone: flag(row.onboarding_done),
    notifyPush: flag(row.notify_push),
    ageConfirmed: Boolean(row.age_confirmed_at),
    notifyEmail: row.notify_email !== false,
    avatarUrl: row.avatar_url || "",
    badges: badgesFrom(
      flag(row.identity_confirmed),
      flag(row.is_organizer),
      stats.n,
      stats.punctual,
      stats.respectful,
      stats.matches,
      stats.yes,
      stats.hosted,
    ),
    theme: readTheme(row.theme),
  };
}

async function ensureProfile(userId: string) {
  const sql = await getSql();
  // Fast path: almost every call hits an existing, named profile. One round trip, stats in parallel.
  const [first, firstStats] = await Promise.all([
    sql<ProfileRow>`select * from profiles where user_id = ${userId}`,
    ratingStats(sql, userId),
  ]);
  if (first[0] && flag(first[0].suspended)) throw new Error("Dein Konto ist gesperrt. Schreib dem Support.");
  if (first[0] && first[0].display_name && first[0].display_name !== "Neu hier") {
    return { sql, profile: mapProfile(first[0], firstStats) };
  }
  const accounts = await sql<{ name: string }>`select name from "user" where id = ${userId}`;
  const fromAccount = clean(accounts[0]?.name ?? "", 40);
  const starter = fromAccount.length >= 2 ? fromAccount : "Neu hier";
  await sql`
    insert into profiles (user_id, display_name)
    values (${userId}, ${starter})
    on conflict (user_id) do nothing
  `;
  if (fromAccount.length >= 2) {
    await sql`
      update profiles set display_name = ${fromAccount}
      where user_id = ${userId} and display_name in ('Neu hier', '')
    `;
  }
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
  const row = rows[0];
  if (!row) throw new Error("Profil fehlt.");
  const stats = await ratingStats(sql, userId);
  return { sql, profile: mapProfile(row, stats) };
}

function mapActivity(row: ActRow, userId: string, origin: { lat: number; lng: number } | null): ActivityCard {
  const intent = row.intent === "date" || row.intent === "friends" || row.intent === "both" ? row.intent : "both";
  const status = row.my_status === "pending" || row.my_status === "accepted" || row.my_status === "declined" || row.my_status === "waitlist" ? row.my_status : null;
  const km = origin ? kmBetween(origin.lat, origin.lng, num(row.lat), num(row.lng)) : null;
  const taken = num(row.taken);
  const spots = num(row.spots);
  return {
    id: row.id,
    hostId: row.host_id,
    hostName: row.display_name,
    hostAvatar: row.avatar_url || "",
    hostBadges: badgesFrom(
      flag(row.identity_confirmed),
      flag(row.is_organizer),
      num(row.rating_n),
      num(row.punctual),
      num(row.respectful),
      num(row.matches),
      num(row.again_yes),
      num(row.hosted),
    ),
    hostOrganizer: flag(row.is_organizer),
    durationMin: num(row.duration_min) || 120,
    area: row.area === "business" ? "business" : row.area === "event" ? "event" : "meetup",
    friendsGoing: [],
    matchesInterest: false,
    fitReason: "",
    title: row.title,
    description: row.description,
    category: row.category,
    traits: parseList(row.traits),
    hostTraits: parseList(row.host_traits),
    intent,
    placeName: row.place_name,
    city: row.city,
    lat: num(row.lat),
    lng: num(row.lng),
    startsAt: iso(row.starts_at),
    spots,
    spotsLeft: Math.max(0, spots - taken),
    imageUrl: row.image_url.startsWith("data:") ? `/media/activity/${row.id}?v=${row.image_url.length}` : row.image_url,
    bookingMode: row.booking_mode === "instant" ? "instant" : "request",
    communityId: row.community_id,
    audienceIds: parseList(row.audience_ids),
    visibility: cleanVisibility(row.visibility),
    hostBirthYear: yearOf(row.host_birth_year),
    publicPlace: flag(row.public_place),
    cancelled: flag(row.cancelled),
    km,
    myStatus: status,
    isHost: row.host_id === userId,
  };
}

async function loadRows(sql: Sql, userId: string, after: string | null = null, only: string | null = null) {
  return sql<ActRow>`
    select a.id, a.host_id, a.title, a.description, a.category, a.intent,
      a.place_name, a.city, a.lat, a.lng, a.starts_at, a.spots, a.image_url,
      a.booking_mode, a.community_id, a.public_place, a.cancelled, a.area, a.duration_min, a.traits, a.visibility, a.audience_ids,
      p.display_name, p.avatar_url, p.is_organizer, p.identity_confirmed, p.traits as host_traits, p.birth_year as host_birth_year,
      coalesce(r.n, 0) as rating_n, coalesce(r.yes, 0) as again_yes,
      (select count(*)::int from activities h where h.host_id = a.host_id and h.starts_at < now() and h.cancelled = false) as hosted, r.punctual, r.respectful, r.matches,
      coalesce(acc.taken, 0) as taken,
      jr.status as my_status
    from activities a
    join profiles p on p.user_id = a.host_id
    left join (
      select ratee_id, count(*)::int as n, count(*) filter (where want_again)::int as yes,
        avg(punctual) as punctual, avg(respectful) as respectful, avg(matches_profile) as matches
      from ratings group by ratee_id
    ) r on r.ratee_id = a.host_id
    left join (
      select activity_id, count(*)::int as taken
      from join_requests where status = 'accepted' group by activity_id
    ) acc on acc.activity_id = a.id
    left join join_requests jr on jr.activity_id = a.id and jr.requester_id = ${userId}
    where (${after}::timestamptz is null or a.starts_at >= ${after}::timestamptz) and (${only}::text is null or a.id = ${only}::text)
    order by a.starts_at asc
  `;
}

async function hiddenSet(sql: Sql, userId: string) {
  const rows = await sql<{ activity_id: string }>`
    select activity_id from hidden_activities where user_id = ${userId}
  `;
  return new Set(rows.map((row) => row.activity_id));
}

function yearOf(value: unknown) {
  const n = Math.round(num(value));
  if (!n || n < 1940 || n > 2012) return null;
  return n;
}

function cleanVisibility(value: unknown): "all" | "friends" | "community" | "events" | "age" {
  return value === "friends" || value === "community" || value === "events" || value === "age" ? value : "all";
}

type Audience = {
  friends: Set<string>;
  communities: Set<string>;
  communityPeople: Set<string>;
  eventPeople: Set<string>;
  birthYear: number | null;
};

async function audienceOf(sql: Sql, userId: string, birthYear: number | null): Promise<Audience> {
  const [friendRows, communityRows, peopleRows, eventRows] = await Promise.all([
  sql<{ other: string }>`
    select case when requester_id = ${userId} then addressee_id else requester_id end as other
    from friendships
    where status = 'accepted' and (requester_id = ${userId} or addressee_id = ${userId})
  `,
  sql<{ community_id: string }>`
    select community_id from community_members where user_id = ${userId}
  `,
  sql<{ user_id: string }>`
    select distinct m2.user_id as user_id
    from community_members m1
    join community_members m2 on m2.community_id = m1.community_id and m2.user_id <> ${userId}
    where m1.user_id = ${userId}
  `,
  sql<{ user_id: string }>`
    select r.requester_id as user_id
    from join_requests r
    join activities a on a.id = r.activity_id
    where a.host_id = ${userId} and r.status = 'accepted'
    union
    select a.host_id as user_id
    from join_requests r
    join activities a on a.id = r.activity_id
    where r.requester_id = ${userId} and r.status = 'accepted'
    union
    select r2.requester_id as user_id
    from join_requests r1
    join join_requests r2 on r2.activity_id = r1.activity_id and r2.status = 'accepted' and r2.requester_id <> ${userId}
    where r1.requester_id = ${userId} and r1.status = 'accepted'
  `,
  ]);
  return {
    friends: new Set(friendRows.map((row) => row.other)),
    communities: new Set(communityRows.map((row) => row.community_id)),
    communityPeople: new Set(peopleRows.map((row) => row.user_id)),
    eventPeople: new Set(eventRows.map((row) => row.user_id)),
    birthYear,
  };
}

function sees(
  visibility: string,
  authorId: string,
  communityId: string | null,
  authorYear: number | null,
  audience: Audience,
  mine: boolean,
  audienceIds: string[] = [],
) {
  if (mine) return true;
  if (visibility === "friends") return audience.friends.has(authorId);
  if (visibility === "community") {
    if (audienceIds.length) return audienceIds.some((id) => audience.communities.has(id));
    if (communityId) return audience.communities.has(communityId);
    return audience.communityPeople.has(authorId);
  }
  if (visibility === "events") return audience.eventPeople.has(authorId);
  if (visibility === "age") {
    if (!audience.birthYear || !authorYear) return false;
    return Math.abs(audience.birthYear - authorYear) <= 5;
  }
  return true;
}

async function memberCommunities(sql: Sql, userId: string, ids: unknown) {
  const wanted = Array.isArray(ids) ? [...new Set(ids.map((item) => clean(item, 80)).filter(Boolean))].slice(0, 12) : [];
  if (!wanted.length) return [];
  const rows = await sql<{ community_id: string }>`select community_id from community_members where user_id = ${userId}`;
  const allowed = new Set(rows.map((row) => row.community_id));
  return wanted.filter((id) => allowed.has(id));
}

async function friendState(sql: Sql, me: string, them: string): Promise<"none" | "out" | "in" | "friends"> {
  if (!them || me === them) return "none";
  const rows = await sql<{ status: string; requester_id: string }>`
    select status, requester_id from friendships
    where (requester_id = ${me} and addressee_id = ${them}) or (requester_id = ${them} and addressee_id = ${me})
    limit 1
  `;
  const row = rows[0];
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester_id === me ? "out" : "in";
}

async function notify(sql: Sql, userId: string, kind: string, title: string, body: string, href: string, refId: string) {
  if (!userId || userId.startsWith("seed:")) return;
  if (kind === "message" || kind === "ad") {
    // One open line per chat instead of one per message.
    const merged = await sql<{ id: string }>`
      update notifications set body = ${body}, title = ${title}, created_at = now()
      where user_id = ${userId} and kind = ${kind} and ref_id = ${refId} and read = false
      returning id
    `;
    if (merged.length) return;
  }
  await sql`
    insert into notifications (id, user_id, kind, title, body, href, ref_id)
    values (${crypto.randomUUID()}, ${userId}, ${kind}, ${title}, ${body}, ${href}, ${refId})
  `;
  await sendPush(sql, userId, title, body, href);
  if (EMAIL_KINDS.has(kind)) await sendEmail(sql, userId, title, body, href);
}

const EMAIL_KINDS = new Set(["request", "accepted", "withdrawn", "wish", "ad", "announce", "changed", "removed"]);

/** Only with a mail service set up and only if the person left mails on. */
async function sendEmail(sql: Sql, userId: string, title: string, body: string, href: string) {
  try {
    const { mailConfigured, sendMail, appUrl } = await import("@/lib/mail.server");
    if (!mailConfigured) return;
    const rows = await sql<{ email: string; notify_email: boolean }>`
      select u.email, p.notify_email from "user" u join profiles p on p.user_id = u.id where u.id = ${userId}
    `;
    if (!rows[0] || rows[0].notify_email === false) return;
    const link = appUrl() ? `\n\n${appUrl()}${href}` : "";
    await sendMail(rows[0].email, `MeeQo: ${title}`, `${title}\n${body}${link}\n\nMails zu Anfragen und Zusagen kannst du in den Einstellungen ausschalten.`);
  } catch {
    /* a mail is a bonus; the notification row is already saved */
  }
}

/** Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. Without them nothing is sent and nothing breaks. */
async function sendPush(sql: Sql, userId: string, title: string, body: string, href: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  try {
    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>`select endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}`;
    if (!subs.length) return;
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hallo@meeqo.app", publicKey, privateKey);
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title, body, href }));
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sql`delete from push_subscriptions where endpoint = ${sub.endpoint}`;
        }
      }),
    );
  } catch {
    /* push is a bonus; the notification row is already saved */
  }
}

function areaOf(category: string, organizer: boolean) {
  if (category === "Business" || category.startsWith("Business · ")) return "business";
  return organizer ? "event" : "meetup";
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const { profile } = await ensureProfile(context.userId);
    return profile;
  });

const profileInput = (input: {
  displayName?: string;
  bio?: string;
  intent?: string;
  openTo?: string;
  areas?: string[];
  seeking?: string[];
  traits?: string[];
  requireTraits?: string[];
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  trustedLabel?: string;
  birthYear?: number;
  defaultVisibility?: string;
  audienceIds?: string[];
  both?: boolean;
}) => input;

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(profileInput)
  .handler(async ({ data, context }) => {
    const { profile } = await ensureProfile(context.userId);
    const sent = clean(data.displayName, 40);
    const name = sent.length >= 2 ? sent : profile.displayName;
    const areas = cleanAreas(data.areas);
    if (!areas.length) throw new Error("Wähl mindestens eins.");
    const intent = intentFromAreas(areas);
    const city = clean(data.city, 60);
    const openTo = openFromAreas(areas);
    const seeking = Array.isArray(data.seeking) ? data.seeking.map((item) => clean(item, 48)).filter(Boolean).slice(0, 12) : [];
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    const precise = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const coords = precise ? { lat, lng } : await lookupPlace(city);
    const sql = await getSql();
    if (coords) {
      await sql`
        update profiles set
          display_name = ${name},
          intent = ${intent},
          open_to = ${openTo},
          areas = ${JSON.stringify(areas)},
          seeking = ${JSON.stringify(seeking)},
          city = ${city},
          lat = ${coords.lat},
          lng = ${coords.lng},
          onboarding_done = true
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        update profiles set
          display_name = ${name},
          intent = ${intent},
          open_to = ${openTo},
          areas = ${JSON.stringify(areas)},
          seeking = ${JSON.stringify(seeking)},
          city = ${city},
          onboarding_done = true
        where user_id = ${context.userId}
      `;
    }
    return { ok: true as const };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(profileInput)
  .handler(async ({ data, context }) => {
    const { profile } = await ensureProfile(context.userId);
    const name = clean(data.displayName ?? profile.displayName, 40);
    const bio = clean(data.bio ?? profile.bio, 280);
    const areas = Array.isArray(data.areas) ? cleanAreas(data.areas) : profile.areas;
    if (Array.isArray(data.areas) && !areas.length) throw new Error("Wähl mindestens eins.");
    const intent = Array.isArray(data.areas) ? intentFromAreas(areas) : clean(data.intent ?? profile.intent, 20);
    const city = clean(data.city ?? profile.city, 60);
    if (name.length < 2) throw new Error("Name ist zu kurz.");
    if (!Array.isArray(data.areas) && intent && !["serious", "curious", "casual", "friends"].includes(intent)) throw new Error("Unbekannte Absicht.");
    const base = intent === "friends" ? "friends" : intent ? "dating" : profile.openTo;
    const openTo = Array.isArray(data.areas)
      ? openFromAreas(areas)
      : data.both
        ? "both"
        : data.openTo && ["dating", "friends", "both"].includes(data.openTo)
          ? data.openTo
          : base;
    const seeking = Array.isArray(data.seeking)
      ? data.seeking.map((item) => clean(item, 48)).filter(Boolean).slice(0, 12)
      : profile.seeking;
    const traits = Array.isArray(data.traits)
      ? data.traits.map((item) => clean(item, 40)).filter(Boolean).slice(0, 12)
      : profile.traits;
    const requireTraits = Array.isArray(data.requireTraits)
      ? data.requireTraits.map((item) => clean(item, 40)).filter(Boolean).slice(0, 12)
      : profile.requireTraits;
    const radius = Number(data.radiusKm ?? profile.radiusKm);
    const trusted = clean(data.trustedLabel ?? profile.trustedLabel, 40);
    const birthYear = data.birthYear === undefined ? profile.birthYear : yearOf(data.birthYear);
    const defaultVisibility = data.defaultVisibility === undefined ? profile.defaultVisibility : cleanVisibility(data.defaultVisibility);
    const coords = city ? await lookupPlace(city) : null;
    const sql = await getSql();
    const audienceIds = data.audienceIds === undefined ? profile.audienceIds : await memberCommunities(sql, context.userId, data.audienceIds);
    await sql`
      update profiles set
        display_name = ${name},
        bio = ${bio},
        intent = ${intent || profile.intent},
        open_to = ${openTo || profile.openTo},
        areas = ${JSON.stringify(areas)},
        seeking = ${JSON.stringify(seeking)},
        traits = ${JSON.stringify(traits)},
        require_traits = ${JSON.stringify(requireTraits)},
        city = ${city},
        radius_km = ${[5, 10, 25, 40, 60, 100].includes(radius) ? radius : profile.radiusKm},
        trusted_label = ${trusted},
        birth_year = ${birthYear},
        default_visibility = ${defaultVisibility},
        audience_ids = ${JSON.stringify(audienceIds)}
      where user_id = ${context.userId}
    `;
    if (coords) {
      await sql`update profiles set lat = ${coords.lat}, lng = ${coords.lng} where user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

export const setLocation = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { lat: number; lng: number; city?: string }) => input)
  .handler(async ({ data, context }) => {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error("Standort ungültig.");
    }
    let city = clean(data.city, 60);
    if (!city) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "User-Agent": "MeeQo/1.0 (activity meetup)", Accept: "application/json" } },
        );
        if (res.ok) {
          const body = (await res.json()) as { address?: { city?: string; town?: string; village?: string } };
          city = body.address?.city || body.address?.town || body.address?.village || "";
        }
      } catch {
        city = "";
      }
    }
    const sql = await getSql();
    await sql`
      update profiles set lat = ${lat}, lng = ${lng}, city = case when ${city} = '' then city else ${city} end
      where user_id = ${context.userId}
    `;
    return { ok: true as const, city };
  });

export type PlaceHit = { city: string; label: string; detail: string; lat: number; lng: number };

export const suggestPlaces = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { q: string }) => ({ q: clean(input.q, 80) }))
  .handler(async ({ data }): Promise<PlaceHit[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    const hits: PlaceHit[] = [];
    const seen = new Set<string>();
    const push = (hit: PlaceHit) => {
      const key = hit.label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      hits.push(hit);
    };
    for (const item of matchCities(q)) {
      push({ city: item.city, label: item.city, detail: "Ganze Stadt", lat: item.lat, lng: item.lng });
    }
    const choices = await plzChoices(q);
    const points = new Map<string, { lat: number; lng: number } | null>();
    await Promise.all(
      [...new Set(choices.map((item) => item.postalCode))].map(async (code) => {
        points.set(code, await plzPoint(code));
      }),
    );
    for (const choice of choices) {
      const point = points.get(choice.postalCode);
      push({
        city: `${choice.postalCode} ${choice.name}`,
        label: `${choice.postalCode} ${choice.name}`,
        detail: choice.state,
        lat: point?.lat ?? Number.NaN,
        lng: point?.lng ?? Number.NaN,
      });
    }
    return hits.slice(0, 12);
  });

export const setPlace = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { city: string; lat?: number; lng?: number }) => ({
    city: clean(input.city, 60),
    lat: Number(input.lat),
    lng: Number(input.lng),
  }))
  .handler(async ({ data, context }) => {
    let city = data.city;
    if (city.length < 2) throw new Error("Welcher Ort?");
    if (/^\d{5}$/.test(city)) {
      const named = (await plzChoices(city))[0];
      if (named) city = `${named.postalCode} ${named.name}`;
    }
    let coords = Number.isFinite(data.lat) && Number.isFinite(data.lng) && Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180
      ? { lat: data.lat, lng: data.lng }
      : await lookupPlace(city);
    const sql = await getSql();
    if (coords) {
      await sql`update profiles set city = ${city}, lat = ${coords.lat}, lng = ${coords.lng} where user_id = ${context.userId}`;
    } else {
      await sql`update profiles set city = ${city} where user_id = ${context.userId}`;
    }
    return { ok: true as const, city };
  });

export const setNotify = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { enabled: boolean }) => ({ enabled: Boolean(input.enabled) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`update profiles set notify_push = ${data.enabled} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const setRequireTraits = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { traits: string[] }) => ({
    traits: Array.isArray(input.traits) ? input.traits.map((item) => clean(item, 40)).filter(Boolean).slice(0, 12) : [],
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`update profiles set require_traits = ${JSON.stringify(data.traits)} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const setRadius = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { radiusKm: number }) => input)
  .handler(async ({ data, context }) => {
    const radius = Number(data.radiusKm);
    if (![5, 10, 25, 40, 60, 100].includes(radius)) throw new Error("Radius ungültig.");
    const sql = await getSql();
    await sql`update profiles set radius_km = ${radius} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const hideActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ host_id: string }>`select host_id from activities where id = ${data.id}`;
    if (!rows.length) throw new Error("Aktivität nicht gefunden.");
    if (rows[0].host_id === context.userId) throw new Error("Eigene Aktivitäten kannst du nicht ausblenden.");
    await sql`
      insert into hidden_activities (user_id, activity_id)
      values (${context.userId}, ${data.id})
      on conflict do nothing
    `;
    return { ok: true as const };
  });

export const unhideActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`
      delete from hidden_activities where user_id = ${context.userId} and activity_id = ${data.id}
    `;
    return { ok: true as const };
  });

export const listHidden = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<ActivityCard[]> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const hidden = await hiddenSet(sql, context.userId);
    const origin = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const rows = await loadRows(sql, context.userId);
    return rows.map((row) => mapActivity(row, context.userId, origin)).filter((item) => hidden.has(item.id));
  });

export const registerOrganizer = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { name: string; city: string; bookingMode: string; bio: string }) => input)
  .handler(async ({ data, context }) => {
    const name = clean(data.name, 60);
    const city = clean(data.city, 60);
    const bio = clean(data.bio, 280);
    const mode = data.bookingMode === "instant" ? "instant" : "request";
    if (name.length < 2) throw new Error("Name des Orts oder Studios fehlt.");
    const coords = cityCoords(city);
    const sql = await getSql();
    await sql`
      update profiles set
        is_organizer = true,
        organizer_name = ${name},
        booking_mode = ${mode},
        bio = case when ${bio} = '' then bio else ${bio} end,
        city = case when ${city} = '' then city else ${city} end
      where user_id = ${context.userId}
    `;
    if (coords) {
      await sql`update profiles set lat = ${coords.lat}, lng = ${coords.lng} where user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

type FeedInput = {
  filter?: string;
  category?: string;
  q?: string;
  city?: string;
  sub?: string;
  radiusKm?: number;
  communityId?: string;
  mineOnly?: boolean;
  includePast?: boolean;
  days?: string[];
  limit?: number;
  /** Only meetups starting within the next four hours, nearest first. */
  soon?: boolean;
  /** "fit" orders by how well a meetup suits the person; default is by time. */
  sort?: "time" | "fit";
};

function searchPlace(data: FeedInput) {
  const explicit = clean(data.city, 60);
  if (explicit) return explicit;
  const q = clean(data.q, 80);
  if (q && cityCoords(q)) return q;
  return "";
}

export const getFeed = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: FeedInput) => input ?? {})
  .handler(async ({ data, context }): Promise<FeedResult> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const limit = Math.min(200, Math.max(1, Math.round(Number(data.limit)) || 30));
    const place = searchPlace(data);
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const [hidden, blocked, audience, rows, looked, againRows, friendRows] = await Promise.all([
      hiddenSet(sql, context.userId),
      blockedWith(sql, context.userId),
      audienceOf(sql, context.userId, profile.birthYear),
      loadRows(sql, context.userId, data.includePast ? null : new Date(cutoff).toISOString()),
      place ? lookupPlace(place) : Promise.resolve(null),
      sql<{ title: string }>`
        select a.title from checkins c
        join activities a on a.id = c.activity_id
        where c.user_id = ${context.userId}
          and c.created_at <= now() - interval '5 days'
          and c.created_at >= now() - interval '12 days'
        order by c.created_at desc
        limit 1
      `,
      sql<{ activity_id: string; display_name: string }>`
        select j.activity_id, p.display_name
        from join_requests j
        join friendships f on f.status = 'accepted'
          and ((f.requester_id = ${context.userId} and f.addressee_id = j.requester_id) or (f.addressee_id = ${context.userId} and f.requester_id = j.requester_id))
        join profiles p on p.user_id = j.requester_id
        where j.status = 'accepted'
        order by j.created_at asc
      `,
    ]);
    const going = new Map<string, string[]>();
    for (const row of friendRows) {
      const list = going.get(row.activity_id) ?? [];
      const first = (row.display_name || "").split(" ")[0];
      if (first && !list.includes(first)) list.push(first);
      going.set(row.activity_id, list);
    }
    const home = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const origin = looked ?? home;
    const radius = Number(data.radiusKm ?? profile.radiusKm) || 25;
    const filter = data.filter ?? "all";
    const sub = clean(data.sub, 48);
    const category = clean(data.category, 48).toLowerCase();
    const qRaw = clean(data.q, 80).toLowerCase();
    const q = place && qRaw === place.toLowerCase() ? "" : qRaw;
    const days = Array.isArray(data.days)
      ? [...new Set(data.days.map((day) => clean(String(day), 10)).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)))].slice(0, 62)
      : [];
    const now = Date.now() - 2 * 60 * 60 * 1000;
    const mapped = rows.map((row) => {
      const item = mapActivity(row, context.userId, origin);
      const names = [...(going.get(item.id) ?? [])];
      const hostFirst = item.hostName.split(" ")[0];
      if (audience.friends.has(item.hostId) && hostFirst && !names.includes(hostFirst)) names.unshift(hostFirst);
      item.friendsGoing = names;
      item.matchesInterest = profile.seeking.includes(splitCategory(item.category).parent);
      return item;
    });
    const pool = mapped.filter((item) => {
      if (item.cancelled) return false;
      if (!item.isHost && blocked.has(item.hostId)) return false;
      if (!data.includePast && new Date(item.startsAt).getTime() < now) return false;
      if (item.isHost) return data.mineOnly ? true : canSeeActivity(profile.areas, profile.openTo, item.intent, item.category) || item.isHost;
      if (!data.mineOnly && hidden.has(item.id)) return false;
      if (item.myStatus) return true;
      if (!canSeeActivity(profile.areas, profile.openTo, item.intent, item.category)) return false;
      return true;
    });
    const base = pool.filter((item) => {
      if (data.mineOnly && !item.isHost && item.myStatus !== "accepted" && item.myStatus !== "pending") return false;
      if (data.communityId && item.communityId !== data.communityId) return false;
      if (!passesLens(filter, item)) return false;
      if (sub && !categoryMatches(item.category, sub)) return false;
      if (category && !categoryMatches(item.category, category)) return false;
      if (!covers([...item.traits, ...item.hostTraits], profile.requireTraits)) return false;
      if (!sees(item.visibility, item.hostId, item.communityId, item.hostBirthYear, audience, item.isHost || Boolean(item.myStatus), item.audienceIds)) return false;
      if (q) {
        const blob = `${item.title} ${item.city} ${item.category} ${item.placeName} ${item.hostName}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    const ordered = (list: ActivityCard[]) => {
      if (data.sort !== "fit" || data.soon) return list;
      const scored = list.map((item) => {
        const fit = fitOf({
          friendsGoing: item.friendsGoing.length,
          matchesInterest: item.matchesInterest,
          km: item.km,
          hoursAway: (new Date(item.startsAt).getTime() - Date.now()) / 3_600_000,
          hostVerified: item.hostBadges.includes("Profil bestätigt"),
          spotsLeft: item.spotsLeft,
        });
        item.fitReason = fit.reason;
        return { item, fit };
      });
      return scored
        .sort((a, b) => b.fit.score - a.fit.score || new Date(a.item.startsAt).getTime() - new Date(b.item.startsAt).getTime())
        .map((entry) => entry.item);
    };
    const soonUntil = Date.now() + 4 * 60 * 60 * 1000;
    const soonFrom = Date.now() - 60 * 60 * 1000;
    const matched = data.soon
      ? base.filter((item) => {
          const at = new Date(item.startsAt).getTime();
          return at >= soonFrom && at <= soonUntil;
        })
      : days.length
        ? base.filter((item) => days.includes(berlinDay(item.startsAt)))
        : base;
    const againTitle = againRows[0]?.title ?? null;
    if (againTitle) {
      const sent = await sql`select 1 as ok from notifications where user_id = ${context.userId} and kind = 'week' and created_at >= now() - interval '7 days'`;
      if (!sent.length) {
        await notify(sql, context.userId, "week", "Nächste Woche wieder?", `${againTitle} war letzte Woche. Schau, was diese Woche frei ist.`, "/", "week");
      }
    }
    const hint = (items: ActivityCard[]) => {
      let nextDay: string | null = null;
      let nextCount = 0;
      if (days.length && items.length === 0) {
        const counts = new Map<string, number>();
        const today = berlinDay();
        for (const item of base) {
          const day = berlinDay(item.startsAt);
          if (day < today || days.includes(day)) continue;
          counts.set(day, (counts.get(day) ?? 0) + 1);
        }
        const first = [...counts.keys()].sort()[0];
        if (first) {
          nextDay = first;
          nextCount = counts.get(first) ?? 0;
        }
      }
      return { nextDay, nextCount, againTitle };
    };
    if (place && !looked) {
      const named = matched.filter((item) => item.city.trim().toLowerCase() === place.toLowerCase());
      named.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      return { items: ordered(named).slice(0, limit), total: named.length, missed: 0, hasLocation: true, around: place, ...hint(named) };
    }
    if (!origin || data.mineOnly) return { items: ordered(matched).slice(0, limit), total: matched.length, missed: 0, hasLocation: Boolean(origin), around: place || undefined, ...hint(matched) };
    const near = matched.filter((item) => item.km != null && item.km <= radius);
    const missed = matched.filter((item) => item.km != null && item.km > radius && item.km <= 120).length;
    if (data.soon) near.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
    else near.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return { items: ordered(near).slice(0, limit), total: near.length, missed, hasLocation: true, around: place || undefined, ...hint(near) };
  });

export const getActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<ActivityDetail> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const [rows, audience, blocked] = await Promise.all([
      loadRows(sql, context.userId, null, data.id),
      audienceOf(sql, context.userId, profile.birthYear),
      blockedWith(sql, context.userId),
    ]);
    const origin = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const row = rows.find((item) => item.id === data.id);
    if (!row) throw new Error("Aktivität nicht gefunden.");
    const activity = mapActivity(row, context.userId, origin);
    if (!activity.isHost && blocked.has(activity.hostId)) throw new Error("Aktivität nicht gefunden.");
    if (!sees(activity.visibility, activity.hostId, activity.communityId, activity.hostBirthYear, audience, activity.isHost || Boolean(activity.myStatus), activity.audienceIds)) {
      throw new Error("Das siehst du mit den Einstellungen dieser Person nicht.");
    }
    if (!activity.isHost && !activity.myStatus && !canSeeActivity(profile.areas, profile.openTo, activity.intent, activity.category)) {
      throw new Error("Diese Aktivität siehst du mit deiner Absicht nicht.");
    }
    const hidden = await hiddenSet(sql, context.userId);
    const checks = await sql<{ safe_at: unknown }>`
      select safe_at from checkins where activity_id = ${activity.id} and user_id = ${context.userId}
    `;
    const otherId = activity.isHost ? "" : activity.hostId;
    const myRatings = await sql<{ want_again: boolean; ratee_id: string }>`
      select want_again, ratee_id from ratings where activity_id = ${activity.id} and rater_id = ${context.userId}
    `;
    const ratedHost = myRatings.some((item) => item.ratee_id === activity.hostId);
    let mutual = false;
    let iWantAgain = false;
    if (!activity.isHost) {
      const mine = myRatings.find((item) => item.ratee_id === otherId);
      iWantAgain = flag(mine?.want_again);
      const theirs = await sql<{ want_again: boolean }>`
        select want_again from ratings
        where activity_id = ${activity.id} and rater_id = ${activity.hostId} and ratee_id = ${context.userId}
      `;
      mutual = iWantAgain && flag(theirs[0]?.want_again);
    }
    const [replyRows, goingRows, mineRow] = await Promise.all([
      sql<{ hours: number | null; n: number }>`
        select avg(extract(epoch from (t.responded_at - t.created_at)) / 3600.0) as hours, count(*)::int as n
        from (
          select j.responded_at, j.created_at from join_requests j join activities a on a.id = j.activity_id
          where a.host_id = ${activity.hostId} and j.responded_at is not null
          order by j.responded_at desc limit 20
        ) t
      `,
      activity.isHost || activity.myStatus === "accepted"
        ? sql<{ user_id: string; display_name: string | null; avatar_url: string | null }>`
            select j.requester_id as user_id, p.display_name, p.avatar_url
            from join_requests j left join profiles p on p.user_id = j.requester_id
            where j.activity_id = ${activity.id} and j.status = 'accepted'
            order by j.created_at asc
          `
        : Promise.resolve([] as { user_id: string; display_name: string | null; avatar_url: string | null }[]),
      sql<{ confirmed_at: unknown }>`select confirmed_at from join_requests where activity_id = ${activity.id} and requester_id = ${context.userId} and status = 'accepted'`,
    ]);
    const hoursAway = (new Date(activity.startsAt).getTime() - Date.now()) / 3_600_000;
    const replies = replyRows[0];
    const queue = await sql<{ id: string; requester_id: string }>`select id, requester_id from join_requests where activity_id = ${activity.id} and status = 'waitlist' order by created_at asc`;
    const position = queue.findIndex((item) => item.requester_id === context.userId);
    return {
      activity,
      hostReplyHours: num(replies?.n) >= 3 && replies?.hours != null ? Math.max(0, num(replies.hours)) : null,
      going: goingRows.map((row) => ({ id: row.user_id, name: row.display_name || "Jemand", avatar: row.avatar_url || "", me: row.user_id === context.userId })),
      waitlistPosition: position >= 0 ? position + 1 : null,
      waitlistCount: activity.isHost ? queue.length : 0,
      needsConfirm: activity.myStatus === "accepted" && mineRow.length > 0 && !mineRow[0].confirmed_at && hoursAway > 0 && hoursAway <= 30,
      checkedIn: checks.length > 0, safe: Boolean(checks[0]?.safe_at), rated: ratedHost, mutual, iWantAgain, hidden: hidden.has(activity.id),
    };
  });

export const confirmAttendance = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; coming: boolean }) => ({ id: clean(input.id, 80), coming: Boolean(input.coming) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    const rows = await sql<{ id: string; host_id: string; title: string }>`
      select j.id, a.host_id, a.title from join_requests j join activities a on a.id = j.activity_id
      where j.activity_id = ${data.id} and j.requester_id = ${context.userId} and j.status = 'accepted'
    `;
    const row = rows[0];
    if (!row) throw new Error("Du bist bei diesem Treffen nicht dabei.");
    if (data.coming) {
      await sql`update join_requests set confirmed_at = now() where id = ${row.id}`;
      return { status: "confirmed" as const };
    }
    await sql`update join_requests set status = 'withdrawn' where id = ${row.id}`;
    await notify(sql, row.host_id, "withdrawn", "Platz frei", `${profile.displayName} kann doch nicht zu „${row.title}“.`, `/activity/${data.id}`, data.id);
    await dropRides(sql, data.id, context.userId);
    await promoteWaitlist(sql, data.id);
    return { status: "withdrawn" as const };
  });

export const createActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: {
    title: string;
    description: string;
    category: string;
    intent: string;
    placeName: string;
    city: string;
    lat?: number;
    lng?: number;
    startsAt: string;
    spots: number;
    imageUrl?: string;
    bookingMode?: string;
    communityId?: string;
    publicPlace?: boolean;
    traits?: string[];
    visibility?: string;
    communityIds?: string[];
    durationMin?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    assertAdult(profile);
    await throttle(sql, context.userId, "activity", 10, 86_400);
    const durationMin = Math.min(480, Math.max(30, Math.round(Number(data.durationMin)) || 120));
    const title = clean(data.title, 80);
    const description = clean(data.description, 800);
    const category = assertCategory(clean(data.category, 48));
    const intent = data.intent === "date" || data.intent === "friends" || data.intent === "both" ? data.intent : "";
    const placeName = clean(data.placeName, 80);
    const city = clean(data.city, 60);
    const spots = Math.round(Number(data.spots));
    const starts = new Date(data.startsAt);
    if (title.length < 3) throw new Error("Titel fehlt.");
    if (!category) throw new Error("Kategorie fehlt.");
    if (!intent) throw new Error("Wähl, wer die Aktivität sehen darf.");
    if (!placeName || !city) throw new Error("Ort und Stadt fehlen.");
    if (!Number.isFinite(spots) || spots < 1 || spots > 40) throw new Error("Plätze zwischen 1 und 40.");
    if (Number.isNaN(starts.getTime()) || starts.getTime() < Date.now() - 60 * 60 * 1000) {
      throw new Error("Zeitpunkt liegt in der Vergangenheit.");
    }
    const looked = await lookupPlace(city);
    const lat = Number.isFinite(Number(data.lat)) ? Number(data.lat) : looked?.lat;
    const lng = Number.isFinite(Number(data.lng)) ? Number(data.lng) : looked?.lng;
    if (lat == null || lng == null) throw new Error("Diese Stadt kenne ich nicht. Nutz den Standort-Knopf oder Karlsruhe, Mannheim, Heidelberg.");
    const publicPlace = intent === "date" && !profile.isOrganizer ? true : data.publicPlace !== false;
    if (intent === "date" && !publicPlace) {
      throw new Error("Dates nur an öffentlichen Orten oder bei einem Veranstalter.");
    }
    let booking: "request" | "instant" = "request";
    if (profile.isOrganizer && data.bookingMode === "instant") booking = "instant";
    if (profile.isOrganizer && data.bookingMode === "request") booking = "request";
    const communityId = clean(data.communityId, 80);
    if (communityId) {
      const member = await sql`select 1 as ok from community_members where community_id = ${communityId} and user_id = ${context.userId}`;
      if (!member.length) throw new Error("Tritt der Community zuerst bei.");
    }
    let imageUrl = clean(data.imageUrl, 450_000);
    if (imageUrl && !imageUrl.startsWith("/activities/") && !validImage(imageUrl)) {
      imageUrl = "";
    }
    if (!imageUrl) throw new Error("Ohne Foto wird nichts veröffentlicht.");
    const id = crypto.randomUUID();
    const activityTraits = Array.isArray(data.traits) ? data.traits.map((item) => clean(item, 40)).filter(Boolean).slice(0, 8) : [];
    const visibility = cleanVisibility(data.visibility);
    const audienceIds = await memberCommunities(sql, context.userId, [...(Array.isArray(data.communityIds) ? data.communityIds : []), ...(communityId ? [communityId] : [])]);
    if (visibility === "community" && !audienceIds.length) throw new Error("Wähl mindestens eine Community.");
    await sql`
      insert into activities (
        id, host_id, title, description, category, intent, place_name, city, lat, lng,
        starts_at, spots, image_url, booking_mode, community_id, public_place, traits, visibility, audience_ids, area, duration_min
      ) values (
        ${id}, ${context.userId}, ${title}, ${description}, ${category}, ${intent}, ${placeName}, ${city},
        ${lat}, ${lng}, ${starts.toISOString()}, ${spots}, ${imageUrl}, ${booking},
        nullif(${communityId}, ''), ${publicPlace}, ${JSON.stringify(activityTraits)}, ${visibility}, ${JSON.stringify(audienceIds)},
        ${areaOf(category, profile.isOrganizer)}, ${durationMin}
      )
    `;
    return { id };
  });

export const cancelActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ title: string }>`
      update activities set cancelled = true where id = ${data.id} and host_id = ${context.userId} returning title
    `;
    if (!rows.length) throw new Error("Nur du kannst deine Aktivität absagen.");
    const guests = await sql<{ requester_id: string }>`
      select requester_id from join_requests where activity_id = ${data.id} and status = 'accepted'
    `;
    for (const guest of guests) {
      await notify(sql, guest.requester_id, "cancelled", "Aktivität abgesagt", rows[0].title, `/activity/${data.id}`, data.id);
    }
    return { ok: true as const };
  });

export const requestJoin = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; mood?: string }) => ({
    id: clean(input.id, 80),
    mood: (MOODS as readonly string[]).includes(input.mood ?? "") ? (input.mood as string) : "",
  }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!profile.onboardingDone) throw new Error("Schließ zuerst das Onboarding ab.");
    assertAdult(profile);
    if (!profile.avatarUrl) throw new Error("Ohne Foto kannst du nicht anfragen. Lad eins im Profil hoch.");
    await throttle(sql, context.userId, "request", 20, 3600);
    const rows = await loadRows(sql, context.userId, null, data.id);
    const row = rows.find((item) => item.id === data.id);
    if (!row) throw new Error("Aktivität nicht gefunden.");
    const activity = mapActivity(row, context.userId, null);
    if (activity.cancelled) throw new Error("Die Aktivität ist abgesagt.");
    if (activity.isHost) throw new Error("Das ist deine eigene Aktivität.");
    if ((await blockedWith(sql, context.userId)).has(activity.hostId)) throw new Error("Das geht nicht.");
    if (!canSeeActivity(profile.areas, profile.openTo, activity.intent, activity.category)) throw new Error("Diese Aktivität passt nicht zu deiner Absicht.");
    if (activity.myStatus === "pending" || activity.myStatus === "accepted" || activity.myStatus === "waitlist") return { status: activity.myStatus };
    const earlier = await sql<{ status: string }>`select status from join_requests where activity_id = ${activity.id} and requester_id = ${context.userId}`;
    if (earlier[0]?.status === "removed") throw new Error("Der Gastgeber hat dich aus diesem Treffen genommen.");
    if (activity.intent === "date" && activity.spots <= 2 && !activity.publicPlace && !activity.hostOrganizer) {
      throw new Error("Dieses Date ist nicht an einem öffentlichen Ort.");
    }
    const full = activity.spotsLeft < 1;
    const status = full ? "waitlist" : activity.bookingMode === "instant" ? "accepted" : "pending";
    const id = crypto.randomUUID();
    await sql`
      insert into join_requests (id, activity_id, requester_id, status, mood)
      values (${id}, ${activity.id}, ${context.userId}, ${status}, ${data.mood})
      on conflict (activity_id, requester_id) do update set status = ${status}, mood = ${data.mood}
    `;
    if (status === "accepted" && (await overbooked(sql, activity.id))) {
      await sql`update join_requests set status = 'waitlist' where activity_id = ${activity.id} and requester_id = ${context.userId}`;
      await notify(sql, context.userId, "waitlist", "Du stehst auf der Warteliste", activity.title, `/activity/${activity.id}`, activity.id);
      return { status: "waitlist" as const };
    }
    if (status === "waitlist") {
      await notify(sql, context.userId, "waitlist", "Du stehst auf der Warteliste", `${activity.title}: Wenn ein Platz frei wird, rückst du nach.`, `/activity/${activity.id}`, activity.id);
      return { status: "waitlist" as const };
    }
    if (status === "accepted") {
      await sql`
        insert into messages (id, activity_id, sender_id, body)
        values (${crypto.randomUUID()}, ${activity.id}, ${activity.hostId}, ${"Schön, dass du dabei bist. Schreib kurz, ob du pünktlich kommst."})
      `;
      await notify(sql, context.userId, "accepted", "Du bist dabei", activity.title, `/chat/${activity.id}`, activity.id);
    } else {
      await notify(sql, activity.hostId, "request", "Neue Anfrage", `${profile.displayName} möchte zu „${activity.title}“`, "/requests", activity.id);
      await notify(sql, context.userId, "pending", "Anfrage raus", activity.title, `/activity/${activity.id}`, activity.id);
    }
    return { status };
  });

/** When a seat frees up, the person who waited longest moves up: straight in for instant booking, to the host's inbox otherwise. */
async function promoteWaitlist(sql: Sql, activityId: string) {
  const act = await sql<{ title: string; host_id: string; spots: number; booking_mode: string; cancelled: boolean; taken: number }>`
    select a.title, a.host_id, a.spots, a.booking_mode, a.cancelled,
      (select count(*)::int from join_requests j where j.activity_id = a.id and j.status = 'accepted') as taken
    from activities a where a.id = ${activityId}
  `;
  const meta = act[0];
  if (!meta || flag(meta.cancelled) || num(meta.taken) >= num(meta.spots)) return;
  const next = await sql<{ id: string; requester_id: string }>`
    select id, requester_id from join_requests where activity_id = ${activityId} and status = 'waitlist' order by created_at asc limit 1
  `;
  const waiting = next[0];
  if (!waiting) return;
  if (meta.booking_mode === "instant") {
    await sql`update join_requests set status = 'accepted', responded_at = now() where id = ${waiting.id}`;
    if (await overbooked(sql, activityId)) {
      await sql`update join_requests set status = 'waitlist', responded_at = null where id = ${waiting.id}`;
      return;
    }
    await sql`
      insert into messages (id, activity_id, sender_id, body)
      values (${crypto.randomUUID()}, ${activityId}, ${meta.host_id}, ${"Schön, dass du nachgerückt bist. Schreib kurz, ob du pünktlich kommst."})
    `;
    await notify(sql, waiting.requester_id, "accepted", "Ein Platz ist frei: du bist dabei", meta.title, `/chat/${activityId}`, activityId);
  } else {
    await sql`update join_requests set status = 'pending' where id = ${waiting.id}`;
    await notify(sql, waiting.requester_id, "pending", "Ein Platz ist frei", `${meta.title}: Der Gastgeber entscheidet jetzt.`, `/activity/${activityId}`, activityId);
    await notify(sql, meta.host_id, "request", "Nachgerückt von der Warteliste", `Für „${meta.title}“ ist jemand nachgerückt.`, "/requests", activityId);
  }
}

/** A person leaves the meetup: their offered ride is cancelled, their seat in someone else's car is freed. */
async function dropRides(sql: Sql, activityId: string, userId: string) {
  const mine = await sql<{ id: string }>`select id from rides where activity_id = ${activityId} and driver_id = ${userId}`;
  for (const ride of mine) {
    const riders = await sql<{ rider_id: string }>`select rider_id from ride_riders where ride_id = ${ride.id}`;
    await sql`delete from ride_riders where ride_id = ${ride.id}`;
    await sql`delete from rides where id = ${ride.id}`;
    for (const rider of riders) await notify(sql, rider.rider_id, "ride", "Fahrt abgesagt", "Deine Mitfahrgelegenheit gibt es nicht mehr.", `/activity/${activityId}`, ride.id);
  }
  await sql`delete from ride_riders where rider_id = ${userId} and ride_id in (select id from rides where activity_id = ${activityId})`;
}

/** Any participant can step out, not only in the last 30 hours. A place on the waitlist can be given up the same way. */
export const leaveActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const found = await sql<{ id: string; status: string; host_id: string; title: string; starts_at: unknown }>`
      select j.id, j.status, a.host_id, a.title, a.starts_at
      from join_requests j join activities a on a.id = j.activity_id
      where j.activity_id = ${data.id} and j.requester_id = ${context.userId} and j.status in ('accepted', 'pending', 'waitlist')
    `;
    const row = found[0];
    if (!row) throw new Error("Du bist bei diesem Treffen nicht dabei.");
    if (new Date(iso(row.starts_at)).getTime() < Date.now()) throw new Error("Das Treffen läuft schon oder ist vorbei.");
    await sql`update join_requests set status = 'withdrawn' where id = ${row.id}`;
    if (row.status === "accepted") {
      const { profile } = await ensureProfile(context.userId);
      await notify(sql, row.host_id, "withdrawn", "Platz frei", `${profile.displayName} kann doch nicht zu „${row.title}“.`, `/activity/${data.id}`, data.id);
      await dropRides(sql, data.id, context.userId);
      await promoteWaitlist(sql, data.id);
    }
    return { ok: true as const };
  });

/** The host takes someone out of the meetup. They cannot ask again. */
export const removeGuest = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; userId: string }) => ({ id: clean(input.id, 80), userId: clean(input.userId, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const act = await sql<{ title: string }>`select title from activities where id = ${data.id} and host_id = ${context.userId}`;
    if (!act[0]) throw new Error("Nur der Gastgeber kann jemanden herausnehmen.");
    const done = await sql<{ status: string }>`
      update join_requests set status = 'removed' where activity_id = ${data.id} and requester_id = ${data.userId} and status in ('accepted', 'pending', 'waitlist') returning status
    `;
    if (!done.length) throw new Error("Diese Person ist nicht dabei.");
    await dropRides(sql, data.id, data.userId);
    await notify(sql, data.userId, "removed", "Du bist nicht mehr dabei", act[0].title, `/activity/${data.id}`, data.id);
    await promoteWaitlist(sql, data.id);
    return { ok: true as const };
  });

/** One message to everyone who is in, with a notification, for "we meet at the entrance". */
export const announce = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; body: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 300) }))
  .handler(async ({ data, context }) => {
    if (data.body.length < 2) throw new Error("Schreib, was alle wissen sollen.");
    const sql = await getSql();
    const act = await sql<{ title: string }>`select title from activities where id = ${data.id} and host_id = ${context.userId} and cancelled = false`;
    if (!act[0]) throw new Error("Nur der Gastgeber kann eine Ansage machen.");
    await throttle(sql, context.userId, "announce", 10, 3600);
    await sql`insert into messages (id, activity_id, sender_id, body) values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${`Ansage: ${data.body}`})`;
    bump(data.id);
    for (const other of await otherMembers(sql, data.id, context.userId)) {
      await notify(sql, other, "announce", `Ansage: ${act[0].title}`, data.body, `/chat/${data.id}`, data.id);
    }
    return { ok: true as const };
  });

export const respondRequest = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; accept: boolean }) => ({ id: clean(input.id, 80), accept: Boolean(input.accept) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ activity_id: string; requester_id: string; title: string; spots: number }>`
      select j.activity_id, j.requester_id, a.title, a.spots
      from join_requests j
      join activities a on a.id = j.activity_id
      where j.id = ${data.id} and a.host_id = ${context.userId} and j.status = 'pending'
    `;
    const row = rows[0];
    if (!row) throw new Error("Anfrage nicht gefunden.");
    if (data.accept) {
      const taken = await sql<{ n: number }>`
        select count(*)::int as n from join_requests where activity_id = ${row.activity_id} and status = 'accepted'
      `;
      if (num(taken[0]?.n) >= num(row.spots)) throw new Error("Keine Plätze mehr frei.");
    }
    const status = data.accept ? "accepted" : "declined";
    await sql`update join_requests set status = ${status}, responded_at = now() where id = ${data.id}`;
    if (data.accept && (await overbooked(sql, row.activity_id))) {
      await sql`update join_requests set status = 'pending', responded_at = null where id = ${data.id}`;
      throw new Error("Keine Plätze mehr frei.");
    }
    if (data.accept) {
      await sql`
        insert into messages (id, activity_id, sender_id, body)
        values (${crypto.randomUUID()}, ${row.activity_id}, ${context.userId}, ${"Ich hab zugesagt. Schreib hier, wenn du unterwegs bist."})
      `;
      await notify(sql, row.requester_id, "accepted", "Zusage", row.title, `/chat/${row.activity_id}`, row.activity_id);
    } else {
      await notify(sql, row.requester_id, "declined", "Diesmal nicht", row.title, `/activity/${row.activity_id}`, row.activity_id);
    }
    return { ok: true as const };
  });

export const listRequests = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<RequestItem[]> => {
    const sql = await getSql();
    const incoming = await sql<{ id: string; activity_id: string; title: string; display_name: string; status: string; created_at: unknown; mood: string; past: number; came: number; with_me: number }>`
      select j.id, j.activity_id, a.title, p.display_name, j.status, j.created_at, j.mood,
        (select count(*)::int from join_requests j2 join activities a2 on a2.id = j2.activity_id
           where j2.requester_id = j.requester_id and j2.status = 'accepted' and a2.starts_at < now() and a2.cancelled = false) as past,
        (select count(*)::int from join_requests j2 join activities a2 on a2.id = j2.activity_id
           join checkins c2 on c2.activity_id = a2.id and c2.user_id = j2.requester_id
           where j2.requester_id = j.requester_id and j2.status = 'accepted' and a2.starts_at < now() and a2.cancelled = false) as came,
        (select count(*)::int from join_requests j3 join activities a3 on a3.id = j3.activity_id
           where j3.requester_id = j.requester_id and a3.host_id = ${context.userId} and j3.status = 'accepted' and a3.starts_at < now() and a3.cancelled = false) as with_me
      from join_requests j
      join activities a on a.id = j.activity_id
      join profiles p on p.user_id = j.requester_id
      where a.host_id = ${context.userId}
      order by j.created_at desc
    `;
    const outgoing = await sql<{ id: string; activity_id: string; title: string; display_name: string; status: string; created_at: unknown; mood: string }>`
      select j.id, j.activity_id, a.title, p.display_name, j.status, j.created_at, j.mood
      from join_requests j
      join activities a on a.id = j.activity_id
      join profiles p on p.user_id = a.host_id
      where j.requester_id = ${context.userId}
      order by j.created_at desc
    `;
    return [
      ...incoming.map((row) => ({
        id: row.id,
        activityId: row.activity_id,
        activityTitle: row.title,
        personName: row.display_name,
        status: row.status,
        createdAt: iso(row.created_at),
        mood: row.mood,
        past: num(row.past),
        came: num(row.came),
        withMe: num(row.with_me),
        direction: "in" as const,
      })),
      ...outgoing.map((row) => ({
        id: row.id,
        activityId: row.activity_id,
        activityTitle: row.title,
        personName: row.display_name,
        status: row.status,
        createdAt: iso(row.created_at),
        mood: row.mood,
        past: 0,
        came: 0,
        withMe: 0,
        direction: "out" as const,
      })),
    ];
  });

export const listChats = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<ChatThread[]> => {
    const sql = await getSql();
    const blocked = await blockedWith(sql, context.userId);
    const rows = await sql<{
      id: string; title: string; starts_at: unknown; host_id: string; host_name: string; host_avatar: string; spots: number;
      last_body: string | null; accepted: number; guest_names: string | null; guest_avatar: string | null; unread: boolean;
    }>`
      select a.id, a.title, a.starts_at, a.host_id, a.spots, p.display_name as host_name, p.avatar_url as host_avatar,
        (select m.body from messages m where m.activity_id = a.id order by m.created_at desc limit 1) as last_body,
        (select count(*)::int from join_requests j where j.activity_id = a.id and j.status = 'accepted') as accepted,
        (select string_agg(g.display_name, ', ' order by g.display_name) from join_requests j
           join profiles g on g.user_id = j.requester_id where j.activity_id = a.id and j.status = 'accepted') as guest_names,
        (select g.avatar_url from join_requests j join profiles g on g.user_id = j.requester_id
           where j.activity_id = a.id and j.status = 'accepted' and g.avatar_url <> '' limit 1) as guest_avatar,
        exists (select 1 from messages m where m.activity_id = a.id and m.sender_id <> ${context.userId}
           and m.created_at > coalesce((select r.read_at from chat_reads r where r.user_id = ${context.userId} and r.thread_id = a.id), 'epoch'::timestamptz)) as unread
      from activities a
      join profiles p on p.user_id = a.host_id
      where a.cancelled = false and (
        exists (select 1 from join_requests j where j.activity_id = a.id and j.requester_id = ${context.userId} and j.status = 'accepted')
        or (a.host_id = ${context.userId} and exists (select 1 from join_requests j where j.activity_id = a.id and j.status = 'accepted'))
      )
      order by a.starts_at asc
    `;
    const threads: ChatThread[] = rows.map((row) => {
      const hosting = row.host_id === context.userId;
      const names = num(row.accepted) + 1;
      return {
        activityId: row.id,
        title: row.title,
        startsAt: iso(row.starts_at),
        lastBody: row.last_body ?? "Noch keine Nachricht",
        peerName: hosting ? row.guest_names || "Noch niemand" : row.host_name,
        peerAvatar: hosting ? row.guest_avatar || "" : row.host_avatar || "",
        group: names >= 3 || num(row.spots) > 2,
        kind: "activity" as const,
        unread: flag(row.unread),
      };
    });
    const adRows = await sql<{ id: string; title: string; peer_id: string; display_name: string | null; avatar_url: string | null; created_at: unknown; last_body: string | null; unread: boolean }>`
      select t.id, c.title, p.user_id as peer_id, p.display_name, p.avatar_url, t.created_at,
        (select m.body from classified_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_body,
        exists (select 1 from classified_messages m where m.thread_id = t.id and m.sender_id <> ${context.userId}
           and m.created_at > coalesce((select r.read_at from chat_reads r where r.user_id = ${context.userId} and r.thread_id = t.id), 'epoch'::timestamptz)) as unread
      from classified_threads t
      join classifieds c on c.id = t.classified_id
      left join profiles p on p.user_id = case when t.buyer_id = ${context.userId} then t.seller_id else t.buyer_id end
      where t.buyer_id = ${context.userId} or t.seller_id = ${context.userId}
      order by t.created_at desc
    `;
    for (const row of adRows) {
      if (blocked.has(row.peer_id)) continue;
      threads.push({
        activityId: row.id,
        title: row.title,
        startsAt: iso(row.created_at),
        lastBody: row.last_body ?? "Noch keine Nachricht",
        peerName: row.display_name || "Jemand",
        peerAvatar: row.avatar_url || "",
        group: false,
        kind: "ad",
        unread: flag(row.unread),
      });
    }
    return threads;
  });

async function markRead(sql: Sql, userId: string, threadId: string) {
  await sql`
    insert into chat_reads (user_id, thread_id, read_at) values (${userId}, ${threadId}, now())
    on conflict (user_id, thread_id) do update set read_at = now()
  `;
}

export const chatUnread = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select (
        (select count(*)::int from activities a
          where a.cancelled = false
            and (exists (select 1 from join_requests j where j.activity_id = a.id and j.requester_id = ${context.userId} and j.status = 'accepted')
              or (a.host_id = ${context.userId} and exists (select 1 from join_requests j where j.activity_id = a.id and j.status = 'accepted')))
            and exists (select 1 from messages m where m.activity_id = a.id and m.sender_id <> ${context.userId}
              and m.created_at > coalesce((select r.read_at from chat_reads r where r.user_id = ${context.userId} and r.thread_id = a.id), 'epoch'::timestamptz)))
        +
        (select count(*)::int from classified_threads t
          where (t.buyer_id = ${context.userId} or t.seller_id = ${context.userId})
            and exists (select 1 from classified_messages m where m.thread_id = t.id and m.sender_id <> ${context.userId}
              and m.created_at > coalesce((select r.read_at from chat_reads r where r.user_id = ${context.userId} and r.thread_id = t.id), 'epoch'::timestamptz)))
      ) as n
    `;
    return { count: num(rows[0]?.n) };
  });

async function assertChat(sql: Sql, activityId: string, userId: string) {
  const rows = await sql<{ host_id: string; title: string }>`
    select host_id, title from activities where id = ${activityId} and cancelled = false
  `;
  const row = rows[0];
  if (!row) throw new Error("Chat nicht gefunden.");
  if (row.host_id === userId) {
    const accepted = await sql`select 1 as ok from join_requests where activity_id = ${activityId} and status = 'accepted'`;
    if (!accepted.length) throw new Error("Der Chat öffnet sich, wenn jemand zugesagt ist.");
    return row;
  }
  const mine = await sql`select 1 as ok from join_requests where activity_id = ${activityId} and requester_id = ${userId} and status = 'accepted'`;
  if (!mine.length) throw new Error("Der Chat öffnet sich nach der Zusage.");
  return row;
}

export const listMessages = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<{ title: string; group: boolean; people: ChatPerson[]; messages: ChatMessage[]; polls: PollView[]; startsAt: string; dayOf: boolean }> => {
    const sql = await getSql();
    const activity = await assertChat(sql, data.id, context.userId);
    await markRead(sql, context.userId, data.id);
    const rows = await sql<{ id: string; sender_id: string; body: string; created_at: unknown; display_name: string | null; avatar_url: string | null }>`
      select * from (
        select m.id, m.sender_id, m.body, m.created_at, p.display_name, p.avatar_url
        from messages m
        left join profiles p on p.user_id = m.sender_id
        where m.activity_id = ${data.id}
        order by m.created_at desc
        limit 200
      ) latest order by created_at asc
    `;
    const members = await sql<{ user_id: string; display_name: string | null; avatar_url: string | null; is_host: boolean }>`
      select a.host_id as user_id, p.display_name, p.avatar_url, true as is_host
      from activities a
      left join profiles p on p.user_id = a.host_id
      where a.id = ${data.id}
      union all
      select j.requester_id as user_id, p.display_name, p.avatar_url, false as is_host
      from join_requests j
      left join profiles p on p.user_id = j.requester_id
      where j.activity_id = ${data.id} and j.status = 'accepted'
      order by is_host desc, display_name asc
    `;
    const spots = await sql<{ spots: number }>`select spots from activities where id = ${data.id}`;
    const meta = await sql<{ starts_at: unknown; duration_min: number; host_id: string }>`select starts_at, duration_min, host_id from activities where id = ${data.id}`;
    const startsAt = iso(meta[0]?.starts_at);
    const hoursTo = (new Date(startsAt).getTime() - Date.now()) / 3_600_000;
    const polls = await loadPolls(sql, data.id, context.userId, meta[0]?.host_id === context.userId);
    return {
      polls,
      startsAt,
      dayOf: hoursTo <= 3 && hoursTo >= -(num(meta[0]?.duration_min) / 60 || 2) - 3,
      title: activity.title,
      group: members.length >= 3 || num(spots[0]?.spots) > 2,
      people: members.map((row) => ({
        id: row.user_id,
        name: row.display_name || "Jemand",
        avatar: row.avatar_url || "",
        isHost: row.is_host,
        me: row.user_id === context.userId,
      })),
      messages: rows.map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        senderName: row.display_name || "Jemand",
        senderAvatar: row.avatar_url || "",
        body: row.body,
        createdAt: iso(row.created_at),
        mine: row.sender_id === context.userId,
      })),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; body: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 1000) }))
  .handler(async ({ data, context }) => {
    if (data.body.length < 1) throw new Error("Nachricht ist leer.");
    const sql = await getSql();
    const activity = await assertChat(sql, data.id, context.userId);
    await throttle(sql, context.userId, "message", 40, 60);
    await sql`
      insert into messages (id, activity_id, sender_id, body)
      values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${data.body})
    `;
    bump(data.id);
    const others = await sql<{ user_id: string }>`
      select requester_id as user_id from join_requests where activity_id = ${data.id} and status = 'accepted' and requester_id <> ${context.userId}
      union
      select host_id as user_id from activities where id = ${data.id} and host_id <> ${context.userId}
    `;
    for (const other of others) {
      await notify(sql, other.user_id, "message", activity.title, data.body, `/chat/${data.id}`, data.id);
    }
    return { ok: true as const };
  });

export const checkIn = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ host_id: string; title: string; starts_at: unknown }>`select host_id, title, starts_at from activities where id = ${data.id}`;
    const row = rows[0];
    if (!row) throw new Error("Aktivität nicht gefunden.");
    const untilStart = (new Date(iso(row.starts_at)).getTime() - Date.now()) / 3_600_000;
    if (untilStart > 2) throw new Error("Einchecken geht ab zwei Stunden vor Beginn.");
    if (untilStart < -12) throw new Error("Das Treffen ist schon zu lange her zum Einchecken.");
    const allowed = row.host_id === context.userId
      ? true
      : (await sql`select 1 as ok from join_requests where activity_id = ${data.id} and requester_id = ${context.userId} and status = 'accepted'`).length > 0;
    if (!allowed) throw new Error("Check-in geht erst nach der Zusage.");
    await sql`
      insert into checkins (activity_id, user_id) values (${data.id}, ${context.userId})
      on conflict do nothing
    `;
    await notify(sql, context.userId, "checkin", "Check-in gespeichert", row.title, `/rating/${data.id}`, data.id);
    return { ok: true as const };
  });

export const rateMeet = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { activityId: string; rateeId: string; punctual: number; respectful: number; matches: number; wantAgain: boolean }) => input)
  .handler(async ({ data, context }) => {
    const punctual = Math.round(Number(data.punctual));
    const respectful = Math.round(Number(data.respectful));
    const matches = Math.round(Number(data.matches));
    const scored = [punctual, respectful, matches].every((value) => value >= 1 && value <= 5);
    const pScore = scored ? punctual : 3;
    const rScore = scored ? respectful : 3;
    const mScore = scored ? matches : 3;
    const sql = await getSql();
    const checked = await sql`select 1 as ok from checkins where activity_id = ${data.activityId} and user_id = ${context.userId}`;
    if (!checked.length) throw new Error("Erst einchecken, dann bewerten.");
    const activity = await sql<{ host_id: string }>`select host_id from activities where id = ${data.activityId}`;
    const hostId = activity[0]?.host_id;
    if (!hostId) throw new Error("Aktivität nicht gefunden.");
    if (data.rateeId === context.userId) throw new Error("Du kannst dich nicht selbst bewerten.");
    const rateeOk = data.rateeId === hostId
      || (await sql`select 1 as ok from join_requests where activity_id = ${data.activityId} and requester_id = ${data.rateeId} and status = 'accepted'`).length > 0;
    if (!rateeOk) throw new Error("Diese Person war nicht dabei.");
    const iBelong = hostId === context.userId
      || (await sql`select 1 as ok from join_requests where activity_id = ${data.activityId} and requester_id = ${context.userId} and status = 'accepted'`).length > 0;
    if (!iBelong) throw new Error("Du warst nicht dabei.");
    await sql`
      insert into ratings (id, activity_id, rater_id, ratee_id, punctual, respectful, matches_profile, want_again)
      values (${crypto.randomUUID()}, ${data.activityId}, ${context.userId}, ${data.rateeId}, ${pScore}, ${rScore}, ${mScore}, ${Boolean(data.wantAgain)})
      on conflict (activity_id, rater_id, ratee_id) do update set
        punctual = ${pScore}, respectful = ${rScore}, matches_profile = ${mScore}, want_again = ${Boolean(data.wantAgain)}
    `;
    const back = await sql<{ want_again: boolean }>`
      select want_again from ratings where activity_id = ${data.activityId} and rater_id = ${data.rateeId} and ratee_id = ${context.userId}
    `;
    const mutual = flag(data.wantAgain) && flag(back[0]?.want_again);
    if (mutual) {
      await notify(sql, context.userId, "again", "Gegenseitig", "Ihr möchtet euch wiedersehen.", `/activity/${data.activityId}`, data.activityId);
      await notify(sql, data.rateeId, "again", "Gegenseitig", "Ihr möchtet euch wiedersehen.", `/activity/${data.activityId}`, data.activityId);
    }
    return { mutual };
  });

export const ratingTargets = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const acts = await sql<{ host_id: string; title: string; display_name: string }>`
      select a.host_id, a.title, p.display_name from activities a
      join profiles p on p.user_id = a.host_id
      where a.id = ${data.id}
    `;
    const act = acts[0];
    if (!act) throw new Error("Aktivität nicht gefunden.");
    const belongs = act.host_id === context.userId
      || (await sql`select 1 as ok from join_requests where activity_id = ${data.id} and requester_id = ${context.userId} and status = 'accepted'`).length > 0;
    if (!belongs) throw new Error("Aktivität nicht gefunden.");
    const checked = await sql`select 1 as ok from checkins where activity_id = ${data.id} and user_id = ${context.userId}`;
    const guests = await sql<{ user_id: string; display_name: string }>`
      select j.requester_id as user_id, p.display_name
      from join_requests j join profiles p on p.user_id = j.requester_id
      where j.activity_id = ${data.id} and j.status = 'accepted'
    `;
    const people = act.host_id === context.userId
      ? guests
      : [{ user_id: act.host_id, display_name: act.display_name }];
    return { title: act.title, checkedIn: checked.length > 0, people };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<Notice[]> => {
    const sql = await getSql();
    const soon = await sql<{ id: string; title: string }>`
      select a.id, a.title from activities a
      where a.cancelled = false and a.starts_at > now() and a.starts_at < now() + interval '36 hours'
      and (
        a.host_id = ${context.userId}
        or exists (
          select 1 from join_requests j
          where j.activity_id = a.id and j.requester_id = ${context.userId} and j.status = 'accepted'
        )
      )
      and not exists (
        select 1 from notifications n where n.user_id = ${context.userId} and n.kind = 'reminder' and n.ref_id = a.id
      )
    `;
    for (const item of soon) {
      await notify(sql, context.userId, "reminder", "Bald geht es los", item.title, `/activity/${item.id}`, item.id);
    }
    // After the meetup: one nudge to answer "wieder treffen?", only for people who checked in.
    const toRate = await sql<{ id: string; title: string }>`
      select a.id, a.title from activities a
      join checkins c on c.activity_id = a.id and c.user_id = ${context.userId}
      where a.cancelled = false
        and a.starts_at + make_interval(mins => a.duration_min) < now() - interval '1 hour'
        and a.starts_at + make_interval(mins => a.duration_min) > now() - interval '3 days'
        and not exists (select 1 from notifications n where n.user_id = ${context.userId} and n.kind = 'rate' and n.ref_id = a.id)
        and not exists (select 1 from ratings r where r.activity_id = a.id and r.rater_id = ${context.userId})
    `;
    for (const item of toRate) {
      await notify(sql, context.userId, "rate", "Wie war's?", `${item.title}: Willst du jemanden wiedersehen?`, `/rating/${item.id}`, item.id);
    }
    const rows = await sql<{ id: string; kind: string; title: string; body: string; href: string; read: boolean; created_at: unknown }>`
      select id, kind, title, body, href, read, created_at from notifications
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      read: flag(row.read),
      createdAt: iso(row.created_at),
    }));
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update notifications set read = true where user_id = ${context.userId} and read = false`;
    return { ok: true as const };
  });

export const getPublicProfile = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<PublicProfile> => {
    await ensureProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<ProfileRow>`select * from profiles where user_id = ${data.id}`;
    const row = rows[0];
    if (!row || !flag(row.onboarding_done) || (await blockedWith(sql, context.userId)).has(data.id)) throw new Error("Profil noch nicht da.");
    const stats = await ratingStats(sql, data.id);
    return {
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      intent: row.intent,
      openTo: row.open_to,
      areas: parseList(row.areas).length ? cleanAreas(parseList(row.areas)) : areasFromOpen(row.open_to),
      city: row.city,
      badges: badgesFrom(
        flag(row.identity_confirmed),
        flag(row.is_organizer),
        stats.n,
        stats.punctual,
        stats.respectful,
        stats.matches,
        stats.yes,
        stats.hosted,
      ),
      avatarUrl: row.avatar_url || "",
      friend: await friendState(sql, context.userId, row.user_id),
      favorite: (await sql`select 1 as ok from favorites where user_id = ${context.userId} and target_id = ${row.user_id}`).length > 0,
    };
  });

export const setAvatar = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { imageUrl: string }) => ({ imageUrl: clean(input.imageUrl, 450_000) }))
  .handler(async ({ data, context }) => {
    const imageUrl = data.imageUrl;
    if (!validImage(imageUrl)) throw new Error("Das Foto muss ein JPEG- oder PNG-Bild sein und darf nicht zu groß sein.");
    const sql = await getSql();
    await sql`update profiles set avatar_url = ${imageUrl} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string }) => ({ userId: clean(input.userId, 80) }))
  .handler(async ({ data, context }) => {
    if (!data.userId || data.userId === context.userId) throw new Error("Diese Person kannst du nicht merken.");
    const sql = await getSql();
    const existing = await sql`select 1 as ok from favorites where user_id = ${context.userId} and target_id = ${data.userId}`;
    if (existing.length) {
      await sql`delete from favorites where user_id = ${context.userId} and target_id = ${data.userId}`;
      return { favorite: false as const };
    }
    await sql`insert into favorites (user_id, target_id) values (${context.userId}, ${data.userId})`;
    return { favorite: true as const };
  });

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<FriendPerson[]> => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string; display_name: string; city: string }>`
      select p.user_id, p.display_name, p.city
      from favorites f join profiles p on p.user_id = f.target_id
      where f.user_id = ${context.userId}
      order by f.created_at desc
    `;
    return rows.map((row) => ({ userId: row.user_id, displayName: row.display_name, city: row.city }));
  });

export const organizerStats = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const upcoming = await sql<{ n: number }>`
      select count(*)::int as n from activities
      where host_id = ${context.userId} and cancelled = false and starts_at >= now()
    `;
    const pending = await sql<{ n: number }>`
      select count(*)::int as n from join_requests j
      join activities a on a.id = j.activity_id
      where a.host_id = ${context.userId} and j.status = 'pending'
    `;
    const accepted = await sql<{ n: number }>`
      select count(*)::int as n from join_requests j
      join activities a on a.id = j.activity_id
      where a.host_id = ${context.userId} and j.status = 'accepted' and a.starts_at >= now()
    `;
    return { upcoming: num(upcoming[0]?.n), pending: num(pending[0]?.n), accepted: num(accepted[0]?.n) };
  });

export const listPosts = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId?: string; communityId?: string }) => ({
    userId: clean(input?.userId, 80),
    communityId: clean(input?.communityId, 80),
  }))
  .handler(async ({ data, context }): Promise<Post[]> => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (data.communityId) {
      const member = await sql`select 1 as ok from community_members where community_id = ${data.communityId} and user_id = ${context.userId}`;
      if (!member.length) throw new Error("Beiträge siehst du als Mitglied.");
    }
    const authorId = data.communityId ? "" : data.userId || context.userId;
    const audience = await audienceOf(sql, context.userId, profile.birthYear);
    const rows = data.communityId
      ? await sql<{ id: string; author_id: string; community_id: string | null; body: string; audience: string; visibility: string; audience_ids: string; require_traits: string; birth_year: number | null; created_at: unknown; display_name: string }>`
          select p.id, p.author_id, p.community_id, p.body, p.audience, p.visibility, p.audience_ids, p.require_traits, p.created_at, pr.display_name, pr.birth_year
          from posts p join profiles pr on pr.user_id = p.author_id
          where p.community_id = ${data.communityId}
          order by p.created_at desc
          limit 40
        `
      : await sql<{ id: string; author_id: string; community_id: string | null; body: string; audience: string; visibility: string; audience_ids: string; require_traits: string; birth_year: number | null; created_at: unknown; display_name: string }>`
          select p.id, p.author_id, p.community_id, p.body, p.audience, p.visibility, p.audience_ids, p.require_traits, p.created_at, pr.display_name, pr.birth_year
          from posts p join profiles pr on pr.user_id = p.author_id
          where p.author_id = ${authorId} and p.community_id is null
          order by p.created_at desc
          limit 40
        `;
    return rows
      .map((row) => {
        return {
          id: row.id,
          authorId: row.author_id,
          authorName: row.display_name,
          communityId: row.community_id,
          body: row.body,
          audience: (row.audience === "date" || row.audience === "friends" ? row.audience : "both") as Post["audience"],
          visibility: cleanVisibility(row.visibility),
          audienceIds: parseList(row.audience_ids),
          requireTraits: parseList(row.require_traits),
          createdAt: iso(row.created_at),
          mine: row.author_id === context.userId,
          authorYear: yearOf(row.birth_year),
        };
      })
      .filter((post) => post.mine || (visible(profile.openTo, post.audience) && covers(profile.traits, post.requireTraits) && sees(post.visibility, post.authorId, post.communityId, post.authorYear, audience, false, post.audienceIds)))
      .map(({ authorYear: _year, audienceIds: _ids, ...post }) => post);
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { body: string; audience?: string; communityId?: string; requireTraits?: string[]; visibility?: string; communityIds?: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!profile.onboardingDone) throw new Error("Schließ zuerst das Onboarding ab.");
    const body = clean(data.body, 500);
    if (body.length < 2) throw new Error("Schreib ein paar Worte.");
    const audience = data.audience === "date" || data.audience === "friends" || data.audience === "both" ? data.audience : "both";
    const requireTraits = Array.isArray(data.requireTraits) ? data.requireTraits.map((item) => clean(item, 40)).filter(Boolean).slice(0, 8) : [];
    const visibility = cleanVisibility(data.visibility);
    const communityId = clean(data.communityId, 80);
    if (communityId) {
      const member = await sql`select 1 as ok from community_members where community_id = ${communityId} and user_id = ${context.userId}`;
      if (!member.length) throw new Error("Nur Mitglieder schreiben in der Gruppe.");
    }
    const audienceIds = await memberCommunities(sql, context.userId, [...(Array.isArray(data.communityIds) ? data.communityIds : []), ...(communityId ? [communityId] : [])]);
    if (visibility === "community" && !audienceIds.length) throw new Error("Wähl mindestens eine Community.");
    await sql`
      insert into posts (id, author_id, community_id, body, audience, require_traits, visibility, audience_ids)
      values (${crypto.randomUUID()}, ${context.userId}, nullif(${communityId}, ''), ${body}, ${audience}, ${JSON.stringify(requireTraits)}, ${visibility}, ${JSON.stringify(audienceIds)})
    `;
    return { ok: true as const };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql`delete from posts where id = ${data.id} and author_id = ${context.userId} returning id`;
    if (!rows.length) throw new Error("Nur eigene Beiträge lassen sich löschen.");
    return { ok: true as const };
  });

export const listCommunities = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<CommunityCard[]> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const rows = await sql<{
      id: string; name: string; topic: string; city: string; description: string; traits: string;
      members: number; activity_count: number; joined: boolean;
    }>`
      select c.id, c.name, c.topic, c.city, c.description, c.traits,
        (select count(*)::int from community_members m where m.community_id = c.id) as members,
        (select count(*)::int from activities a where a.community_id = c.id and a.cancelled = false and a.starts_at > now() - interval '2 hours') as activity_count,
        exists (select 1 from community_members m where m.community_id = c.id and m.user_id = ${context.userId}) as joined
      from communities c
      order by c.city, c.name
    `;
    return rows
      .filter((row) => covers(parseList(row.traits), profile.requireTraits))
      .map((row) => ({
      id: row.id,
      name: row.name,
      topic: row.topic,
      city: row.city,
      description: row.description,
      members: num(row.members),
      activityCount: num(row.activity_count),
      joined: flag(row.joined),
    }));
  });

export const getCommunity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    const rows = await sql<{ id: string; name: string; topic: string; city: string; description: string }>`
      select id, name, topic, city, description from communities where id = ${data.id}
    `;
    const community = rows[0];
    if (!community) throw new Error("Community nicht gefunden.");
    const member = await sql`select 1 as ok from community_members where community_id = ${data.id} and user_id = ${context.userId}`;
    const joined = member.length > 0;
    const origin = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const all = await loadRows(sql, context.userId);
    const hidden = await hiddenSet(sql, context.userId);
    const activities = joined
      ? all
          .map((row) => mapActivity(row, context.userId, origin))
          .filter((item) => item.communityId === data.id && !item.cancelled && !hidden.has(item.id) && (item.isHost || item.myStatus || canSeeActivity(profile.areas, profile.openTo, item.intent, item.category)))
      : [];
    return { ...community, joined, activities };
  });

export const joinCommunity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const found = await sql`select 1 as ok from communities where id = ${data.id}`;
    if (!found.length) throw new Error("Community nicht gefunden.");
    await sql`
      insert into community_members (community_id, user_id) values (${data.id}, ${context.userId})
      on conflict do nothing
    `;
    return { ok: true as const };
  });

export const createCommunity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { name: string; topic: string; city: string; description: string }) => input)
  .handler(async ({ data, context }) => {
    const name = clean(data.name, 60);
    const topic = clean(data.topic, 48);
    const city = clean(data.city, 60);
    const description = clean(data.description, 400);
    if (name.length < 3 || !topic || !city) throw new Error("Name, Thema und Stadt fehlen.");
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into communities (id, owner_id, name, topic, city, description)
      values (${id}, ${context.userId}, ${name}, ${topic}, ${city}, ${description})
    `;
    await sql`insert into community_members (community_id, user_id) values (${id}, ${context.userId})`;
    return { id };
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; name: string; parent: string | null }>`
      select id, name, parent from custom_categories where user_id = ${context.userId} order by parent, name
    `;
    return rows.map((row) => ({ id: row.id, name: row.name, parent: row.parent ?? "" }));
  });

export const addCategory = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { name: string; parent: string }) => ({
    name: clean(input.name, 30).replace(/·/g, "").trim(),
    parent: clean(input.parent, 30),
  }))
  .handler(async ({ data, context }) => {
    if (!CATEGORIES.includes(data.parent)) throw new Error("Wähl zuerst eine Kategorie.");
    if (data.name.length < 2) throw new Error("Name zu kurz.");
    const sql = await getSql();
    const existing = await sql<{ id: string }>`
      select id from custom_categories
      where user_id = ${context.userId} and lower(parent) = ${data.parent.toLowerCase()} and lower(name) = ${data.name.toLowerCase()}
    `;
    if (!existing.length) {
      await sql`
        insert into custom_categories (id, user_id, name, parent)
        values (${crypto.randomUUID()}, ${context.userId}, ${data.name}, ${data.parent})
      `;
    }
    return { ok: true as const };
  });

export const removeCategory = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`delete from custom_categories where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

function readTheme(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return normalizeTheme(JSON.parse(raw));
  } catch {
    return null;
  }
}

export const designTheme = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { note?: string }) => ({ note: clean(input.note, 240) }))
  .handler(async ({ data, context }) => {
    if (data.note.length < 2) throw new Error("Beschreib kurz, wie es aussehen soll.");
    const { sql } = await ensureProfile(context.userId);
    let theme = localTheme(data.note);
    let source: "ai" | "local" = "local";
    const apiKey = process.env.XAI_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(12000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "grok-4.5",
            max_tokens: 220,
            messages: [
              {
                role: "system",
                content: "Du gestaltest ein App-Farbschema. Antworte nur mit JSON {\"name\": string, \"sand\": \"#rrggbb\", \"accent\": \"#rrggbb\", \"friend\": \"#rrggbb\", \"ink\": \"#rrggbb\", \"radius\": \"soft\"|\"round\"|\"tight\", \"font\": \"warm\"|\"calm\"|\"plain\"}. name auf Deutsch, höchstens drei Wörter. sand ist der Hintergrund, accent die Hauptfarbe, friend eine zweite Farbe, ink die Textfarbe. Kein Neon, genug Abstand zwischen Text und Grund. font warm ist serif und weich, calm ist ruhig, plain ist schlicht.",
              },
              { role: "user", content: data.note },
            ],
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const text = body.choices?.[0]?.message?.content ?? "";
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          const parsed = start >= 0 ? normalizeTheme(JSON.parse(text.slice(start, end + 1))) : null;
          if (parsed) {
            theme = parsed;
            source = "ai";
          }
        }
      } catch {
        source = "local";
      }
    }
    await sql`update profiles set theme = ${JSON.stringify(theme)} where user_id = ${context.userId}`;
    return { source, theme };
  });

export const resetTheme = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update profiles set theme = '' where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const suggestActivities = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { note?: string; city?: string }) => ({ note: clean(input.note, 300), city: clean(input.city, 60) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    const hidden = await hiddenSet(sql, context.userId);
    const looked = data.city ? cityCoords(data.city) : null;
    const origin = looked ?? (profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null);
    const rows = await loadRows(sql, context.userId);
    const now = Date.now() - 2 * 60 * 60 * 1000;
    let items = rows
      .map((row) => mapActivity(row, context.userId, origin))
      .filter((item) => !item.cancelled && !item.isHost && !hidden.has(item.id) && new Date(item.startsAt).getTime() >= now && canSeeActivity(profile.areas, profile.openTo, item.intent, item.category));
    if (data.city && !looked) items = items.filter((item) => item.city.trim().toLowerCase() === data.city.toLowerCase());
    else if (origin) {
      const near = items.filter((item) => item.km != null && item.km <= Math.max(profile.radiusKm, 60));
      if (near.length) items = near;
    }
    const wanted = (data.city || profile.city).toLowerCase();
    const local = [...items].sort((a, b) => {
      const score = (item: ActivityCard) =>
        (profile.seeking.some((sought) => categoryMatches(item.category, sought)) ? 2 : 0) + (item.city.toLowerCase() === wanted ? 1 : 0);
      return score(b) - score(a);
    }).slice(0, 3);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey || items.length === 0) {
      return { source: "local" as const, reason: "Passend zu dem, was du suchst, und in deiner Nähe.", items: local };
    }
    const catalog = items.slice(0, 24).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      city: item.city,
      intent: item.intent,
    }));
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 280,
          messages: [
            {
              role: "system",
              content: "Du wählst Aktivitäten aus einem Katalog. Antworte nur mit JSON {\"ids\": string[], \"reason\": string}. reason auf Deutsch, höchstens zwei Sätze. Erfinde keine IDs. Höchstens 3 IDs.",
            },
            {
              role: "user",
              content: JSON.stringify({
                person: { intent: profile.intent, openTo: profile.openTo, seeking: profile.seeking, city: profile.city },
                note: data.note,
                catalog,
              }),
            },
          ],
        }),
      });
      if (!res.ok) return { source: "local" as const, reason: "Passend zu dem, was du suchst.", items: local };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const parsed = start >= 0 ? (JSON.parse(text.slice(start, end + 1)) as { ids?: string[]; reason?: string }) : null;
      const ids = new Set((parsed?.ids ?? []).filter((id) => catalog.some((item) => item.id === id)));
      const picked = items.filter((item) => ids.has(item.id)).slice(0, 3);
      if (!picked.length) return { source: "local" as const, reason: "Passend zu dem, was du suchst.", items: local };
      return { source: "ai" as const, reason: clean(parsed?.reason, 240) || "Das passt zu deiner Notiz.", items: picked };
    } catch {
      return { source: "local" as const, reason: "Passend zu dem, was du suchst.", items: local };
    }
  });

export const supportAsk = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { question: string }) => ({ question: clean(input.question, 500) }))
  .handler(async ({ data }) => {
    if (data.question.length < 4) throw new Error("Schreib eine kurze Frage.");
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, text: "Die Hilfe ist gerade nicht erreichbar. Die Fragen unten decken das Wichtigste ab." };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 320,
        messages: [
          {
            role: "system",
            content: "Du bist die Hilfe von MeeQo, einer App zum Kennenlernen über Aktivitäten. Antworte auf Deutsch, kurz, ohne Marketing. Fakten: Date-Aktivitäten sehen nur Menschen mit Dating-Absicht oder 'beides'. Freunde-Aktivitäten nur die anderen. Teilnahme über Anfrage, außer Veranstalter mit Sofortbuchung. Jede fremde Aktivität lässt sich ausblenden und bleibt dann aus Feed, Suche, Communities und Vorschlägen weg, bis man sie in den Einstellungen wieder zeigt. Eigene Termine und Zusagen bleiben unter Meine Aktivitäten. Beiträge gibt es auf dem eigenen Profil und in Gruppen, denen man beigetreten ist. Jeder Beitrag hat eine Absicht: Date, Freundschaft oder beides, und folgt derselben Sichtbarkeit. Unter Einstellungen kann jede Person mit einer kurzen Beschreibung ein eigenes Farbschema, Schrift und Ecken erzeugen und das MeeQo-Original wiederherstellen. Unter Kategorien legt man eigene Unterkategorien an, immer unter einer vorhandenen Kategorie. 1:1-Dates nur öffentlich oder bei Veranstaltern. Bewertungen nach Check-in: pünktlich, respektvoll, wie im Profil. 'Gerne wiedersehen' wird nur gezeigt, wenn beide es wollen. Profil bestätigt ist eine Selbstauskunft, keine Ausweisprüfung. Es gibt keine echten Zahlungen. Keine medizinische oder rechtliche Beratung. Bei Gefahr: 112.",
          },
          { role: "user", content: data.question },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, text: "Die Hilfe antwortet gerade nicht. Versuch es später noch einmal." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { ok: true as const, text: body.choices?.[0]?.message?.content?.trim() || "Dazu habe ich gerade keine Antwort." };
  });

export const searchCategories = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { q?: string }) => ({ q: clean(input?.q, 40).toLowerCase() }))
  .handler(async ({ data }): Promise<{ hits: CategoryHit[]; promoted: CategoryHit[] }> => {
    const sql = await getSql();
    const rows = await sql<{ parent: string; name: string; n: number }>`
      select parent, name, count(distinct user_id)::int as n
      from custom_categories
      where parent <> ''
      group by parent, name
    `;
    const custom = rows.map((row) => ({
      parent: row.parent,
      name: row.name,
      count: num(row.n),
      promoted: num(row.n) >= PROMOTE_AT,
    }));
    const built: CategoryHit[] = CATEGORY_TREE.flatMap((group) => [
      { parent: group.name, name: "", count: 0, promoted: true },
      ...group.subs.map((name) => ({ parent: group.name, name, count: 0, promoted: true })),
      ...MORE_SUGGESTIONS.filter((item) => item.parent === group.name).map((item) => ({
        parent: item.parent,
        name: item.name,
        count: 0,
        promoted: false,
      })),
    ]);
    const merged = new Map<string, CategoryHit>();
    for (const item of built) merged.set(`${item.parent}::${item.name}`.toLowerCase(), item);
    for (const item of custom) {
      merged.set(`${item.parent}::${item.name}`.toLowerCase(), {
        parent: item.parent,
        name: item.name,
        count: item.count,
        promoted: item.count >= PROMOTE_AT,
      });
    }
    const all = [...merged.values()];
    const q = data.q;
    const hits = q
      ? all.filter((item) => `${item.parent} ${item.name}`.toLowerCase().includes(q)).slice(0, 12)
      : [];
    const promoted = custom.filter((item) => item.count >= PROMOTE_AT);
    return { hits, promoted };
  });

async function loadClassifieds(userId: string): Promise<Classified[]> {
    const { sql, profile } = await ensureProfile(userId);
    const audience = await audienceOf(sql, userId, profile.birthYear);
    const rows = await sql<{
      id: string; author_id: string; title: string; body: string; category: string; city: string;
      price: string; traits: string; visibility: string; audience_ids: string; created_at: unknown; display_name: string; author_traits: string; birth_year: number | null;
    }>`
      select c.id, c.author_id, c.title, c.body, c.category, c.city, c.price, c.traits, c.visibility, c.audience_ids, c.created_at,
        p.display_name, p.traits as author_traits, p.birth_year
      from classifieds c
      join profiles p on p.user_id = c.author_id
      order by c.created_at desc
      limit 40
    `;
    const blocked = await blockedWith(sql, userId);
    const mineThreads = await sql<{ classified_id: string; id: string }>`select classified_id, id from classified_threads where buyer_id = ${userId}`;
    const threads = new Map(mineThreads.map((row) => [row.classified_id, row.id]));
    const countRows = await sql<{ classified_id: string; n: number }>`select classified_id, count(*)::int as n from classified_threads where seller_id = ${userId} group by classified_id`;
    const counts = new Map(countRows.map((row) => [row.classified_id, row.n]));
    return rows
      .map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: row.display_name,
        title: row.title,
        body: row.body,
        category: row.category,
        city: row.city,
        price: row.price,
        traits: parseList(row.traits),
        createdAt: iso(row.created_at),
        mine: row.author_id === userId,
        authorTraits: parseList(row.author_traits),
        visibility: cleanVisibility(row.visibility),
        audienceIds: parseList(row.audience_ids),
        authorYear: yearOf(row.birth_year),
      }))
      .filter((item) => !blocked.has(item.authorId) && covers([...item.traits, ...item.authorTraits], profile.requireTraits) && sees(item.visibility, item.authorId, null, item.authorYear, audience, item.mine, item.audienceIds))
      .map(({ authorTraits: _authorTraits, authorYear: _year, visibility: _visibility, audienceIds: _ids, ...item }) => ({
        ...item,
        interested: item.mine ? num(counts.get(item.id)) : 0,
        myThread: threads.get(item.id) ?? null,
      }));
}

export const listClassifieds = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<Classified[]> => loadClassifieds(context.userId));

export const createClassified = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { title: string; body: string; category: string; city: string; price?: string; traits?: string[]; visibility?: string; communityIds?: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    assertAdult(profile);
    await throttle(sql, context.userId, "classified", 10, 86_400);
    const title = clean(data.title, 80);
    const body = clean(data.body, 400);
    const category = clean(data.category, 40);
    const city = clean(data.city || profile.city, 60);
    const price = clean(data.price, 20);
    const traits = Array.isArray(data.traits) ? data.traits.map((item) => clean(item, 40)).filter(Boolean).slice(0, 8) : [];
    const visibility = cleanVisibility(data.visibility);
    const audienceIds = await memberCommunities(sql, context.userId, data.communityIds);
    if (visibility === "community" && !audienceIds.length) throw new Error("Wähl mindestens eine Community.");
    if (title.length < 3) throw new Error("Titel fehlt.");
    if (!category) throw new Error("Wähl, ob du etwas anbietest oder suchst.");
    await sql`
      insert into classifieds (id, author_id, title, body, category, city, price, traits, visibility, audience_ids)
      values (${crypto.randomUUID()}, ${context.userId}, ${title}, ${body}, ${category}, ${city}, ${price}, ${JSON.stringify(traits)}, ${visibility}, ${JSON.stringify(audienceIds)})
    `;
    return { ok: true as const };
  });

export const requestFriend = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string }) => ({ userId: clean(input.userId, 80) }))
  .handler(async ({ data, context }) => {
    if (!data.userId || data.userId === context.userId) throw new Error("Das geht nicht.");
    const { sql, profile } = await ensureProfile(context.userId);
    const other = await sql<ProfileRow>`select * from profiles where user_id = ${data.userId}`;
    if (!other[0] || !flag(other[0].onboarding_done)) throw new Error("Profil noch nicht da.");
    if ((await blockedWith(sql, context.userId)).has(data.userId)) throw new Error("Das geht nicht.");
    const existing = await sql<{ id: string; status: string; requester_id: string }>`
      select id, status, requester_id from friendships
      where (requester_id = ${context.userId} and addressee_id = ${data.userId})
         or (requester_id = ${data.userId} and addressee_id = ${context.userId})
      limit 1
    `;
    const row = existing[0];
    if (row?.status === "accepted") return { status: "friends" as const };
    if (row && row.requester_id === data.userId) {
      await sql`update friendships set status = 'accepted' where id = ${row.id}`;
      await notify(sql, data.userId, "friend", "Freundschaft angenommen", `${profile.displayName} ist jetzt dabei.`, "/friends", context.userId);
      return { status: "friends" as const };
    }
    if (!row) {
      await sql`
        insert into friendships (id, requester_id, addressee_id, status)
        values (${crypto.randomUUID()}, ${context.userId}, ${data.userId}, 'pending')
      `;
      await notify(sql, data.userId, "friend", "Freundschaftsanfrage", `${profile.displayName} möchte befreundet sein.`, "/friends", context.userId);
    }
    return { status: "out" as const };
  });

export const respondFriend = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string; accept: boolean }) => ({ userId: clean(input.userId, 80), accept: Boolean(input.accept) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (data.accept) {
      const rows = await sql`
        update friendships set status = 'accepted'
        where requester_id = ${data.userId} and addressee_id = ${context.userId} and status = 'pending'
        returning id
      `;
      if (!rows.length) throw new Error("Keine offene Anfrage.");
      await notify(sql, data.userId, "friend", "Freundschaft angenommen", `${profile.displayName} ist jetzt dabei.`, "/friends", context.userId);
      return { status: "friends" as const };
    }
    await sql`
      delete from friendships
      where requester_id = ${data.userId} and addressee_id = ${context.userId} and status = 'pending'
    `;
    return { status: "none" as const };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string }) => ({ userId: clean(input.userId, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`
      delete from friendships
      where (requester_id = ${context.userId} and addressee_id = ${data.userId})
         or (requester_id = ${data.userId} and addressee_id = ${context.userId})
    `;
    return { ok: true as const };
  });

export const friendOverview = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    const links = await sql<{ other: string; status: string; requester_id: string; display_name: string; city: string }>`
      select case when f.requester_id = ${context.userId} then f.addressee_id else f.requester_id end as other,
        f.status, f.requester_id, p.display_name, p.city
      from friendships f
      join profiles p on p.user_id = case when f.requester_id = ${context.userId} then f.addressee_id else f.requester_id end
      where f.requester_id = ${context.userId} or f.addressee_id = ${context.userId}
      order by p.display_name
    `;
    const person = (row: { other: string; display_name: string; city: string }): FriendPerson => ({
      userId: row.other,
      displayName: row.display_name,
      city: row.city,
    });
    const friends = links.filter((row) => row.status === "accepted").map(person);
    const incoming = links.filter((row) => row.status === "pending" && row.requester_id !== context.userId).map(person);
    const outgoing = links.filter((row) => row.status === "pending" && row.requester_id === context.userId).map(person);
    const audience = await audienceOf(sql, context.userId, profile.birthYear);
    const ids = new Set(friends.map((item) => item.userId));
    const activities = (await loadRows(sql, context.userId))
      .map((row) => mapActivity(row, context.userId, profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null))
      .filter((item) => ids.has(item.hostId) && !item.cancelled && new Date(item.startsAt).getTime() > Date.now() - 2 * 60 * 60 * 1000)
      .filter((item) => sees(item.visibility, item.hostId, item.communityId, item.hostBirthYear, audience, false, item.audienceIds));
    const postRows = ids.size
      ? await sql<{ id: string; author_id: string; body: string; audience: string; visibility: string; audience_ids: string; require_traits: string; created_at: unknown; display_name: string; birth_year: number | null }>`
          select p.id, p.author_id, p.body, p.audience, p.visibility, p.audience_ids, p.require_traits, p.created_at, pr.display_name, pr.birth_year
          from posts p
          join profiles pr on pr.user_id = p.author_id
          where p.community_id is null
          order by p.created_at desc
          limit 80
        `
      : [];
    const posts = postRows
      .map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: row.display_name,
        communityId: null,
        body: row.body,
        audience: (row.audience === "date" || row.audience === "friends" ? row.audience : "both") as Post["audience"],
        visibility: cleanVisibility(row.visibility),
        audienceIds: parseList(row.audience_ids),
        requireTraits: parseList(row.require_traits),
        createdAt: iso(row.created_at),
        mine: false,
        authorYear: yearOf(row.birth_year),
      }))
      .filter((post) => ids.has(post.authorId) && visible(profile.openTo, post.audience) && covers(profile.traits, post.requireTraits) && sees(post.visibility, post.authorId, null, post.authorYear, audience, false, post.audienceIds))
      .map(({ authorYear: _year, audienceIds: _ids, ...post }) => post);
    return { friends, incoming, outgoing, activities, posts };
  });

export const listPersonActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<ActivityCard[]> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const audience = await audienceOf(sql, context.userId, profile.birthYear);
    const origin = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const now = Date.now() - 2 * 60 * 60 * 1000;
    return (await loadRows(sql, context.userId))
      .map((row) => mapActivity(row, context.userId, origin))
      .filter((item) => item.hostId === data.id && !item.cancelled && new Date(item.startsAt).getTime() >= now)
      .filter((item) => canSeeActivity(profile.areas, profile.openTo, item.intent, item.category))
      .filter((item) => sees(item.visibility, item.hostId, item.communityId, item.hostBirthYear, audience, false, item.audienceIds));
  });



// ---------------------------------------------------------------------------
// Kleinanzeigen: Interesse melden und chatten

export const expressInterest = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; body?: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 500) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    assertAdult(profile);
    if (!profile.avatarUrl) throw new Error("Ohne Foto kannst du nicht anfragen. Lad eins im Profil hoch.");
    await throttle(sql, context.userId, "interest", 20, 3600);
    const ad = (await loadClassifieds(context.userId)).find((item) => item.id === data.id);
    if (!ad) throw new Error("Anzeige nicht gefunden.");
    if (ad.mine) throw new Error("Das ist deine eigene Anzeige.");
    if ((await blockedWith(sql, context.userId)).has(ad.authorId)) throw new Error("Das geht nicht.");
    const existing = await sql<{ id: string }>`select id from classified_threads where classified_id = ${ad.id} and buyer_id = ${context.userId}`;
    let threadId = existing[0]?.id ?? "";
    if (!threadId) {
      threadId = crypto.randomUUID();
      await sql`
        insert into classified_threads (id, classified_id, buyer_id, seller_id)
        values (${threadId}, ${ad.id}, ${context.userId}, ${ad.authorId})
      `;
    }
    if (!existing.length || data.body) {
      const body = data.body || `Hallo, ich interessiere mich für „${ad.title}“.`;
      await sql`
        insert into classified_messages (id, thread_id, sender_id, body)
        values (${crypto.randomUUID()}, ${threadId}, ${context.userId}, ${body})
      `;
      await notify(sql, ad.authorId, "ad", "Interesse an deiner Anzeige", `${profile.displayName}: ${ad.title}`, `/chat/anzeige/${threadId}`, threadId);
    }
    return { threadId };
  });

async function assertAdThread(sql: Sql, threadId: string, userId: string) {
  const rows = await sql<{ id: string; classified_id: string; buyer_id: string; seller_id: string; title: string; price: string; city: string; category: string }>`
    select t.id, t.classified_id, t.buyer_id, t.seller_id, c.title, c.price, c.city, c.category
    from classified_threads t join classifieds c on c.id = t.classified_id
    where t.id = ${threadId}
  `;
  const row = rows[0];
  if (!row || (row.buyer_id !== userId && row.seller_id !== userId)) throw new Error("Chat nicht gefunden.");
  return row;
}

export const listAdMessages = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<AdChat> => {
    const sql = await getSql();
    const thread = await assertAdThread(sql, data.id, context.userId);
    await markRead(sql, context.userId, data.id);
    const seller = thread.seller_id === context.userId;
    const peerId = seller ? thread.buyer_id : thread.seller_id;
    const peer = await sql<{ display_name: string | null; avatar_url: string | null }>`select display_name, avatar_url from profiles where user_id = ${peerId}`;
    const rows = await sql<{ id: string; sender_id: string; body: string; created_at: unknown; display_name: string | null; avatar_url: string | null }>`
      select * from (
        select m.id, m.sender_id, m.body, m.created_at, p.display_name, p.avatar_url
        from classified_messages m left join profiles p on p.user_id = m.sender_id
        where m.thread_id = ${data.id} order by m.created_at desc limit 200
      ) latest order by created_at asc
    `;
    return {
      title: thread.title,
      price: thread.price,
      city: thread.city,
      category: thread.category,
      seller,
      peerId,
      peerName: peer[0]?.display_name || "Jemand",
      peerAvatar: peer[0]?.avatar_url || "",
      messages: rows.map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        senderName: row.display_name || "Jemand",
        senderAvatar: row.avatar_url || "",
        body: row.body,
        createdAt: iso(row.created_at),
        mine: row.sender_id === context.userId,
      })),
    };
  });

export const sendAdMessage = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; body: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 1000) }))
  .handler(async ({ data, context }) => {
    if (data.body.length < 1) throw new Error("Nachricht ist leer.");
    const sql = await getSql();
    const thread = await assertAdThread(sql, data.id, context.userId);
    const other = thread.seller_id === context.userId ? thread.buyer_id : thread.seller_id;
    if ((await blockedWith(sql, context.userId)).has(other)) throw new Error("Das geht nicht.");
    await throttle(sql, context.userId, "message", 40, 60);
    await sql`
      insert into classified_messages (id, thread_id, sender_id, body)
      values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${data.body})
    `;
    bump(data.id);
    await notify(sql, other, "ad", thread.title, data.body, `/chat/anzeige/${data.id}`, data.id);
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Treffen wiederholen

export const repeatActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; weeks?: number }) => ({
    id: clean(input.id, 80),
    weeks: Math.min(12, Math.max(1, Math.round(Number(input.weeks)) || 1)),
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const found = await sql<{ starts_at: unknown }>`select starts_at from activities where id = ${data.id} and host_id = ${context.userId}`;
    if (!found.length) throw new Error("Nur der Ersteller kann ein Treffen wiederholen.");
    const base = iso(found[0].starts_at);
    let offset = 1;
    while (new Date(addDaysBerlin(base, 7 * offset)).getTime() < Date.now() + 60 * 60 * 1000) offset += 1;
    let first = "";
    for (let index = 0; index < data.weeks; index += 1) {
      const id = crypto.randomUUID();
      if (!first) first = id;
      await sql`
        insert into activities (
          id, host_id, title, description, category, intent, place_name, city, lat, lng,
          starts_at, spots, image_url, booking_mode, community_id, public_place, traits, visibility, audience_ids, area, duration_min
        )
        select ${id}, host_id, title, description, category, intent, place_name, city, lat, lng,
          ${addDaysBerlin(base, 7 * (offset + index))}, spots, image_url, booking_mode, community_id, public_place, traits, visibility, audience_ids, area, duration_min
        from activities where id = ${data.id} and host_id = ${context.userId}
      `;
    }
    return { id: first, count: data.weeks };
  });

// ---------------------------------------------------------------------------
// Lust auf ein Treffen, das es noch nicht gibt

const WISH_AT = 3;

function wishCategory(value: unknown) {
  return clean(value, 48) || "Treffen";
}

export const wishInfo = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { category: string }) => ({ category: wishCategory(input.category) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    const rows = await sql<{ n: number; mine: number }>`
      select count(*)::int as n, count(*) filter (where user_id = ${context.userId})::int as mine
      from wishes where category = ${data.category} and city = ${profile.city} and created_at >= now() - interval '14 days'
    `;
    return { count: num(rows[0]?.n), mine: num(rows[0]?.mine) > 0, atLeast: WISH_AT };
  });

export const makeWish = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { category: string; day?: string }) => ({ category: wishCategory(input.category), day: clean(input.day, 10) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!profile.city) throw new Error("Stell zuerst deinen Ort ein.");
    await throttle(sql, context.userId, "wish", 20, 3600);
    await sql`
      insert into wishes (id, user_id, category, city, day)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.category}, ${profile.city}, ${data.day})
      on conflict (user_id, category, city) do update set created_at = now(), day = ${data.day}
    `;
    const who = await sql<{ user_id: string }>`
      select user_id from wishes
      where category = ${data.category} and city = ${profile.city} and created_at >= now() - interval '14 days'
      order by created_at asc
    `;
    if (who.length === WISH_AT) {
      await notify(sql, who[0].user_id, "wish", `${WISH_AT} Leute wollen ${data.category}`, `In ${profile.city}. Leg ein Treffen an, die anderen finden es sofort.`, "/create", `wish:${data.category}:${profile.city}`);
    }
    return { count: who.length };
  });

// ---------------------------------------------------------------------------
// Vertrauensperson: Link mit Zeit, Ort und Check-in-Status

export const createSafetyLink = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const act = await sql<{ host_id: string }>`select host_id from activities where id = ${data.id} and cancelled = false`;
    if (!act.length) throw new Error("Aktivität nicht gefunden.");
    const belongs = act[0].host_id === context.userId
      || (await sql`select 1 as ok from join_requests where activity_id = ${data.id} and requester_id = ${context.userId} and status = 'accepted'`).length > 0;
    if (!belongs) throw new Error("Den Link gibt es erst nach der Zusage.");
    const old = await sql<{ token: string }>`select token from safety_shares where user_id = ${context.userId} and activity_id = ${data.id} limit 1`;
    if (old[0]) return { path: `/sicher/${old[0].token}` };
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 40);
    await sql`insert into safety_shares (token, user_id, activity_id) values (${token}, ${context.userId}, ${data.id})`;
    return { path: `/sicher/${token}` };
  });

/** Public on purpose: the person who gets the link has no account. The token is the secret. */
export const getSafetyView = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => ({ token: clean(input.token, 80) }))
  .handler(async ({ data }): Promise<SafetyView> => {
    const sql = await getSql();
    const rows = await sql<{ title: string; starts_at: unknown; place_name: string; city: string; display_name: string | null; checked: unknown; safe: unknown }>`
      select a.title, a.starts_at, a.place_name, a.city, p.display_name,
        (select c.created_at from checkins c where c.activity_id = a.id and c.user_id = s.user_id) as checked,
        (select c.safe_at from checkins c where c.activity_id = a.id and c.user_id = s.user_id) as safe
      from safety_shares s
      join activities a on a.id = s.activity_id
      left join profiles p on p.user_id = s.user_id
      where s.token = ${data.token}
    `;
    const row = rows[0];
    if (!row) throw new Error("Dieser Link gilt nicht mehr.");
    const startsAt = iso(row.starts_at);
    const late = Math.floor((Date.now() - new Date(startsAt).getTime()) / 60000) - 30;
    const checkedInAt = row.checked ? iso(row.checked) : null;
    return {
      name: (row.display_name || "Jemand").split(" ")[0],
      title: row.title,
      startsAt,
      placeName: row.place_name,
      city: row.city,
      checkedInAt,
      safeAt: row.safe ? iso(row.safe) : null,
      state: row.safe ? "safe" : checkedInAt ? "ok" : late > 0 ? "late" : "waiting",
      minutesLate: checkedInAt ? 0 : Math.max(0, late),
    };
  });

// ---------------------------------------------------------------------------
// Wieder getroffen: nur gegenseitiges Ja

export const listCircle = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<CircleMember[]> => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string; display_name: string | null; avatar_url: string | null; n: number }>`
      select r.ratee_id as user_id, p.display_name, p.avatar_url, count(*)::int as n
      from ratings r
      join ratings b on b.activity_id = r.activity_id and b.rater_id = r.ratee_id and b.ratee_id = r.rater_id
      left join profiles p on p.user_id = r.ratee_id
      where r.rater_id = ${context.userId} and r.want_again and b.want_again
      group by r.ratee_id, p.display_name, p.avatar_url
      order by count(*) desc, p.display_name asc
    `;
    return rows.map((row) => ({ id: row.user_id, name: row.display_name || "Jemand", avatar: row.avatar_url || "", meetings: num(row.n) }));
  });

// ---------------------------------------------------------------------------
// Melden und Blockieren

const REPORT_KINDS = ["person", "activity", "ad", "message"] as const;

export const reportItem = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { kind: string; targetId: string; reason: string; note?: string }) => ({
    kind: clean(input.kind, 12),
    targetId: clean(input.targetId, 80),
    reason: clean(input.reason, 40),
    note: clean(input.note, 400),
  }))
  .handler(async ({ data, context }) => {
    if (!(REPORT_KINDS as readonly string[]).includes(data.kind) || !data.targetId) throw new Error("Das lässt sich nicht melden.");
    if (!(REPORT_REASONS as readonly string[]).includes(data.reason)) throw new Error("Wähl einen Grund.");
    const sql = await getSql();
    await throttle(sql, context.userId, "report", 10, 3600);
    await sql`
      insert into reports (id, reporter_id, kind, target_id, reason, note)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.kind}, ${data.targetId}, ${data.reason}, ${data.note})
    `;
    return { ok: true as const };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string }) => ({ userId: clean(input.userId, 80) }))
  .handler(async ({ data, context }) => {
    if (!data.userId || data.userId === context.userId) throw new Error("Das geht nicht.");
    const sql = await getSql();
    await sql`insert into blocks (blocker_id, blocked_id) values (${context.userId}, ${data.userId}) on conflict do nothing`;
    await sql`
      delete from friendships
      where (requester_id = ${context.userId} and addressee_id = ${data.userId}) or (requester_id = ${data.userId} and addressee_id = ${context.userId})
    `;
    await sql`delete from favorites where user_id = ${context.userId} and target_id = ${data.userId}`;
    await sql`
      update join_requests set status = 'declined'
      where status = 'pending' and (
        (requester_id = ${data.userId} and activity_id in (select id from activities where host_id = ${context.userId}))
        or (requester_id = ${context.userId} and activity_id in (select id from activities where host_id = ${data.userId}))
      )
    `;
    return { ok: true as const };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string }) => ({ userId: clean(input.userId, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`delete from blocks where blocker_id = ${context.userId} and blocked_id = ${data.userId}`;
    return { ok: true as const };
  });

export const listBlocked = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<BlockedUser[]> => {
    const sql = await getSql();
    const rows = await sql<{ blocked_id: string; display_name: string | null; avatar_url: string | null }>`
      select b.blocked_id, p.display_name, p.avatar_url
      from blocks b left join profiles p on p.user_id = b.blocked_id
      where b.blocker_id = ${context.userId} order by b.created_at desc
    `;
    return rows.map((row) => ({ id: row.blocked_id, name: row.display_name || "Jemand", avatar: row.avatar_url || "" }));
  });

// ---------------------------------------------------------------------------
// Konto und Daten loeschen

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { confirm: string }) => ({ confirm: clean(input.confirm, 20) }))
  .handler(async ({ data, context }) => {
    if (data.confirm !== "LÖSCHEN") throw new Error("Tipp zur Bestätigung: LÖSCHEN");
    const sql = await getSql();
    const me = context.userId;
    await sql`delete from join_requests where requester_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from messages where sender_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from checkins where user_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from ratings where rater_id = ${me} or ratee_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from hidden_activities where user_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from safety_shares where user_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from invites where inviter_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from poll_votes where user_id = ${me} or poll_id in (select id from polls where creator_id = ${me} or activity_id in (select id from activities where host_id = ${me}))`;
    await sql`delete from polls where creator_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from ride_riders where rider_id = ${me} or ride_id in (select id from rides where driver_id = ${me} or activity_id in (select id from activities where host_id = ${me}))`;
    await sql`delete from rides where driver_id = ${me} or activity_id in (select id from activities where host_id = ${me})`;
    await sql`delete from calendar_tokens where user_id = ${me}`;
    await sql`delete from chat_reads where user_id = ${me}`;
    await sql`delete from rate_events where user_id = ${me}`;
    await sql`delete from password_resets where user_id = ${me}`;
    await sql`delete from activities where host_id = ${me}`;
    await sql`
      delete from classified_messages where sender_id = ${me} or thread_id in (
        select id from classified_threads where buyer_id = ${me} or seller_id = ${me} or classified_id in (select id from classifieds where author_id = ${me}))
    `;
    await sql`delete from classified_threads where buyer_id = ${me} or seller_id = ${me} or classified_id in (select id from classifieds where author_id = ${me})`;
    await sql`delete from classifieds where author_id = ${me}`;
    await sql`delete from posts where author_id = ${me}`;
    await sql`delete from community_members where user_id = ${me} or community_id in (select id from communities where owner_id = ${me})`;
    await sql`update activities set community_id = null where community_id in (select id from communities where owner_id = ${me})`;
    await sql`delete from communities where owner_id = ${me}`;
    await sql`delete from friendships where requester_id = ${me} or addressee_id = ${me}`;
    await sql`delete from favorites where user_id = ${me} or target_id = ${me}`;
    await sql`delete from custom_categories where user_id = ${me}`;
    await sql`delete from wishes where user_id = ${me}`;
    await sql`delete from blocks where blocker_id = ${me} or blocked_id = ${me}`;
    await sql`delete from reports where reporter_id = ${me}`;
    await sql`delete from notifications where user_id = ${me}`;
    await sql`delete from push_subscriptions where user_id = ${me}`;
    await sql`delete from profiles where user_id = ${me}`;
    await sql`delete from "user" where id = ${me}`;
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Einladung per Link

export const createInvite = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const act = await sql<{ host_id: string }>`select host_id from activities where id = ${data.id} and cancelled = false`;
    if (!act.length) throw new Error("Aktivität nicht gefunden.");
    const belongs = act[0].host_id === context.userId
      || (await sql`select 1 as ok from join_requests where activity_id = ${data.id} and requester_id = ${context.userId} and status = 'accepted'`).length > 0;
    if (!belongs) throw new Error("Einladen können der Ersteller und alle, die dabei sind.");
    const old = await sql<{ token: string }>`select token from invites where activity_id = ${data.id} and inviter_id = ${context.userId} limit 1`;
    if (old[0]) return { path: `/einladung/${old[0].token}` };
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
    await sql`insert into invites (token, activity_id, inviter_id) values (${token}, ${data.id}, ${context.userId})`;
    return { path: `/einladung/${token}` };
  });

/** Public on purpose: shows only title, time, place and the host's first name. Anfragen needs an account. */
export const getInvite = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => ({ token: clean(input.token, 80) }))
  .handler(async ({ data }): Promise<InviteView> => {
    const sql = await getSql();
    const rows = await sql<{ id: string; title: string; starts_at: unknown; place_name: string; city: string; spots: number; taken: number; display_name: string | null; image_url: string; cancelled: boolean }>`
      select a.id, a.title, a.starts_at, a.place_name, a.city, a.spots, a.image_url, a.cancelled, p.display_name,
        (select count(*)::int from join_requests j where j.activity_id = a.id and j.status = 'accepted') as taken
      from invites i
      join activities a on a.id = i.activity_id
      left join profiles p on p.user_id = a.host_id
      where i.token = ${data.token}
    `;
    const row = rows[0];
    if (!row || flag(row.cancelled)) throw new Error("Diese Einladung gilt nicht mehr.");
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    return {
      origin: getRequestUrl().origin,
      activityId: row.id,
      title: row.title,
      startsAt: iso(row.starts_at),
      placeName: row.place_name,
      city: row.city,
      hostName: (row.display_name || "Jemand").split(" ")[0],
      spotsLeft: Math.max(0, num(row.spots) - num(row.taken)),
      imageUrl: row.image_url.startsWith("data:") ? `/media/activity/${row.id}?v=${row.image_url.length}` : row.image_url,
    };
  });

// ---------------------------------------------------------------------------
// Web-Push

export const pushKey = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async () => ({ key: process.env.VAPID_PUBLIC_KEY || "" }));

export const savePush = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { endpoint: string; p256dh: string; auth: string }) => ({
    endpoint: clean(input.endpoint, 600),
    p256dh: clean(input.p256dh, 200),
    auth: clean(input.auth, 100),
  }))
  .handler(async ({ data, context }) => {
    if (!data.endpoint.startsWith("https://") || !data.p256dh || !data.auth) throw new Error("Abo ungültig.");
    const sql = await getSql();
    await sql`
      insert into push_subscriptions (endpoint, user_id, p256dh, auth)
      values (${data.endpoint}, ${context.userId}, ${data.p256dh}, ${data.auth})
      on conflict (endpoint) do update set user_id = ${context.userId}, p256dh = ${data.p256dh}, auth = ${data.auth}
    `;
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Moderation: wer Admin ist, steht in ADMIN_EMAILS (kommagetrennt), nicht in der Datenbank.

async function isAdminUser(sql: Sql, userId: string) {
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return false;
  const rows = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  return allowed.includes((rows[0]?.email || "").toLowerCase());
}

async function requireAdmin(sql: Sql, userId: string) {
  if (!(await isAdminUser(sql, userId))) throw new Error("Nicht gefunden.");
}

export const adminStatus = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => ({ admin: await isAdminUser(await getSql(), context.userId) }));

export const listReports = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<AdminReport[]> => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const rows = await sql<{
      id: string; kind: string; target_id: string; reason: string; note: string; created_at: unknown; status: string; action: string;
      reporter_name: string | null; same_target: number;
      label: string | null; owner_id: string | null; owner_name: string | null; owner_suspended: boolean | null;
    }>`
      select r.id, r.kind, r.target_id, r.reason, r.note, r.created_at, r.status, r.action,
        rp.display_name as reporter_name,
        (select count(*)::int from reports x where x.kind = r.kind and x.target_id = r.target_id) as same_target,
        case r.kind
          when 'activity' then a.title
          when 'ad' then coalesce(c.title, c2.title)
          when 'person' then tp.display_name
          else r.target_id
        end as label,
        case r.kind
          when 'activity' then a.host_id
          when 'ad' then coalesce(c.author_id, c2.author_id)
          when 'person' then r.target_id
          else null
        end as owner_id
      from reports r
      left join profiles rp on rp.user_id = r.reporter_id
      left join activities a on r.kind = 'activity' and a.id = r.target_id
      left join classifieds c on r.kind = 'ad' and c.id = r.target_id
      left join classified_threads t on r.kind = 'ad' and t.id = r.target_id
      left join classifieds c2 on c2.id = t.classified_id
      left join profiles tp on r.kind = 'person' and tp.user_id = r.target_id
      order by (r.status = 'open') desc, r.created_at desc
      limit 100
    `;
    const owners = new Map<string, { name: string; suspended: boolean }>();
    for (const id of new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id)))) {
      const found = await sql<{ display_name: string; suspended: boolean }>`select display_name, suspended from profiles where user_id = ${id}`;
      owners.set(id, { name: found[0]?.display_name || "Gelöscht", suspended: flag(found[0]?.suspended) });
    }
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      targetId: row.target_id,
      targetLabel: row.label || "Nicht mehr da",
      ownerId: row.owner_id || "",
      ownerName: row.owner_id ? owners.get(row.owner_id)?.name || "Gelöscht" : "",
      ownerSuspended: row.owner_id ? owners.get(row.owner_id)?.suspended ?? false : false,
      reason: row.reason,
      note: row.note,
      reporterName: row.reporter_name || "Gelöscht",
      createdAt: iso(row.created_at),
      status: row.status === "done" ? "done" : "open",
      action: row.action,
      sameTarget: num(row.same_target),
    }));
  });

export const handleReport = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; action: string }) => ({ id: clean(input.id, 80), action: clean(input.action, 12) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    if (!["dismiss", "remove", "suspend", "restore"].includes(data.action)) throw new Error("Unbekannte Aktion.");
    const found = await sql<{ kind: string; target_id: string; reporter_id: string }>`select kind, target_id, reporter_id from reports where id = ${data.id}`;
    const report = found[0];
    if (!report) throw new Error("Meldung nicht gefunden.");
    let ownerId = "";
    if (report.kind === "activity") {
      ownerId = (await sql<{ host_id: string }>`select host_id from activities where id = ${report.target_id}`)[0]?.host_id ?? "";
    } else if (report.kind === "ad") {
      ownerId = (await sql<{ author_id: string }>`
        select coalesce(c.author_id, c2.author_id) as author_id
        from (select 1) x
        left join classifieds c on c.id = ${report.target_id}
        left join classified_threads t on t.id = ${report.target_id}
        left join classifieds c2 on c2.id = t.classified_id
      `)[0]?.author_id ?? "";
    } else if (report.kind === "person") {
      ownerId = report.target_id;
    }
    if (data.action === "remove") {
      if (report.kind === "activity") {
        await sql`update activities set cancelled = true where id = ${report.target_id}`;
      } else if (report.kind === "ad") {
        const adId = (await sql<{ id: string }>`
          select coalesce(c.id, c2.id) as id
          from (select 1) x
          left join classifieds c on c.id = ${report.target_id}
          left join classified_threads t on t.id = ${report.target_id}
          left join classifieds c2 on c2.id = t.classified_id
        `)[0]?.id;
        if (adId) {
          await sql`delete from classified_messages where thread_id in (select id from classified_threads where classified_id = ${adId})`;
          await sql`delete from classified_threads where classified_id = ${adId}`;
          await sql`delete from classifieds where id = ${adId}`;
        }
      } else {
        throw new Error("Bei Personen: Konto sperren.");
      }
    }
    if ((data.action === "suspend" || data.action === "restore") && !ownerId) throw new Error("Hier gibt es keine Person zum Sperren.");
    if (data.action === "remove" && ownerId) {
      await notify(sql, ownerId, "removed", "Dein Inhalt wurde entfernt", "Er verstößt gegen die Community-Regeln. Wenn du das für falsch hältst, schreib dem Support.", "/support", data.id);
    }
    if (data.action === "suspend") await sql`update profiles set suspended = true where user_id = ${ownerId}`;
    if (data.action === "restore") await sql`update profiles set suspended = false where user_id = ${ownerId}`;
    if (ownerId) suspendedCache.delete(ownerId);
    if (data.action !== "restore") {
      await sql`update reports set status = 'done', action = ${data.action}, handled_at = now() where id = ${data.id}`;
      await notify(sql, report.reporter_id, "report", "Deine Meldung ist bearbeitet", "Danke, dass du Bescheid gesagt hast.", "/", data.id);
    }
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// 18+ und Bestaetigt

export const confirmAge = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { year: number; adult: boolean }) => ({ year: Math.round(Number(input.year)), adult: Boolean(input.adult) }))
  .handler(async ({ data, context }) => {
    const thisYear = new Date().getFullYear();
    if (!data.adult) throw new Error("MeeQo ist erst ab 18.");
    if (!Number.isFinite(data.year) || data.year < thisYear - 110 || data.year > thisYear - 18) throw new Error("Mit diesem Geburtsjahr bist du noch nicht 18.");
    const { sql } = await ensureProfile(context.userId);
    await sql`update profiles set birth_year = ${data.year}, age_confirmed_at = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });

/** The Bestaetigt badge is never self-service. An admin sets it after checking. */
export const setVerified = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string; value: boolean }) => ({ userId: clean(input.userId, 80), value: Boolean(input.value) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`update profiles set identity_confirmed = ${data.value} where user_id = ${data.userId}`;
    return { ok: true as const };
  });

export const setNotifyEmail = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { enabled: boolean }) => ({ enabled: Boolean(input.enabled) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`update profiles set notify_email = ${data.enabled} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Passwort vergessen. Oeffentlich, antwortet immer gleich, damit niemand Adressen erraten kann.

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => ({ email: clean(input.email, 200).toLowerCase() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { ok: true as const };
    await throttle(sql, `mail:${data.email}`, "reset", 3, 3600);
    const users = await sql<{ id: string }>`select id from "user" where lower(email) = ${data.email}`;
    const user = users[0];
    if (!user) return { ok: true as const };
    const { createHash, randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    await sql`
      insert into password_resets (token_hash, user_id, expires_at)
      values (${hash}, ${user.id}, now() + interval '1 hour')
    `;
    const { sendMail, appUrl } = await import("@/lib/mail.server");
    const link = `${appUrl()}/passwort?token=${token}`;
    await sendMail(data.email, "MeeQo: Neues Passwort", `Du hast ein neues Passwort angefordert. Der Link gilt eine Stunde:\n\n${link}\n\nWar das nicht du, ignorier diese Mail.`);
    return { ok: true as const };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator((input: { token: string; password: string }) => ({ token: clean(input.token, 100), password: String(input.password ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    if (data.password.length < 8) throw new Error("Das Passwort braucht mindestens 8 Zeichen.");
    const sql = await getSql();
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(data.token).digest("hex");
    const rows = await sql<{ user_id: string }>`
      select user_id from password_resets where token_hash = ${hash} and used = false and expires_at > now()
    `;
    const row = rows[0];
    if (!row) throw new Error("Dieser Link gilt nicht mehr. Fordere einen neuen an.");
    const { auth } = await import("@/lib/auth/server");
    const context = await auth.$context;
    const password = await context.password.hash(data.password);
    await sql`update "account" set "password" = ${password}, "updatedAt" = now() where "userId" = ${row.user_id} and "providerId" = 'credential'`;
    await sql`delete from "session" where "userId" = ${row.user_id}`;
    await sql`update password_resets set used = true where token_hash = ${hash}`;
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Zahlen und Fehler, ohne fremden Dienst

export const logClientError = createServerFn({ method: "POST" })
  .validator((input: { message: string; path?: string }) => ({ message: clean(input.message, 300), path: clean(input.path, 120) }))
  .handler(async ({ data }) => {
    if (!data.message) return { ok: true as const };
    const sql = await getSql();
    try {
      await throttle(sql, "global", "client-error", 60, 60);
    } catch {
      return { ok: true as const };
    }
    await sql`insert into error_log (path, message) values (${data.path}, ${data.message})`;
    if (Math.random() < 0.02) await sql`delete from error_log where created_at < now() - interval '30 days'`;
    return { ok: true as const };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<AdminStats> => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const one = async (query: Promise<{ n: number }[]>) => num((await query)[0]?.n);
    const [users, newUsers7, onboarded, activities7, requests7, messages7, answered, total7, accepted, unanswered24h, openReports, errors24, errorList] = await Promise.all([
      one(sql<{ n: number }>`select count(*)::int as n from "user"`),
      one(sql<{ n: number }>`select count(*)::int as n from "user" where "createdAt" > now() - interval '7 days'`),
      one(sql<{ n: number }>`select count(*)::int as n from profiles where onboarding_done and user_id not like 'seed:%'`),
      one(sql<{ n: number }>`select count(*)::int as n from activities where created_at > now() - interval '7 days' and host_id not like 'seed:%'`),
      one(sql<{ n: number }>`select count(*)::int as n from join_requests where created_at > now() - interval '7 days'`),
      one(sql<{ n: number }>`select count(*)::int as n from messages where created_at > now() - interval '7 days'`),
      one(sql<{ n: number }>`select count(*)::int as n from join_requests where created_at > now() - interval '30 days' and status <> 'pending' and responded_at is not null`),
      one(sql<{ n: number }>`select count(*)::int as n from join_requests where created_at > now() - interval '30 days' and created_at < now() - interval '24 hours'`),
      one(sql<{ n: number }>`select count(*)::int as n from join_requests where created_at > now() - interval '30 days' and status = 'accepted' and responded_at is not null`),
      one(sql<{ n: number }>`select count(*)::int as n from join_requests where status = 'pending' and created_at < now() - interval '24 hours'`),
      one(sql<{ n: number }>`select count(*)::int as n from reports where status = 'open'`),
      one(sql<{ n: number }>`select count(*)::int as n from error_log where created_at > now() - interval '24 hours'`),
      sql<{ path: string; message: string; created_at: unknown }>`select path, message, created_at from error_log order by created_at desc limit 8`,
    ]);
    return {
      users,
      newUsers7,
      onboarded,
      activities7,
      requests7,
      messages7,
      answeredRate: total7 ? Math.round((answered / total7) * 100) : null,
      acceptRate: answered ? Math.round((accepted / answered) * 100) : null,
      unanswered24h,
      openReports,
      errors24,
      errorList: errorList.map((row) => ({ path: row.path, message: row.message, createdAt: iso(row.created_at) })),
    };
  });

// ---------------------------------------------------------------------------
// Meine Daten herunterladen (Art. 20 DSGVO)

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<MyData> => {
    const sql = await getSql();
    const me = context.userId;
    const [account, profile, activities, requests, messages, adMessages, ratingsGiven, ratingsReceived, classifieds, posts, friends, favorites, blocks, wishes, reports, checkins, communities, rides, polls, votes] = await Promise.all([
      sql`select name, email, "createdAt" as created_at from "user" where id = ${me}`,
      sql`select * from profiles where user_id = ${me}`,
      sql`select id, title, description, category, intent, place_name, city, starts_at, spots, cancelled, created_at from activities where host_id = ${me} order by starts_at`,
      sql`select j.activity_id, a.title, j.status, j.mood, j.created_at from join_requests j join activities a on a.id = j.activity_id where j.requester_id = ${me} order by j.created_at`,
      sql`select activity_id, body, created_at from messages where sender_id = ${me} order by created_at`,
      sql`select thread_id, body, created_at from classified_messages where sender_id = ${me} order by created_at`,
      sql`select activity_id, ratee_id, want_again, punctual, respectful, matches_profile, created_at from ratings where rater_id = ${me}`,
      sql`select count(*)::int as total, count(*) filter (where want_again)::int as yes from ratings where ratee_id = ${me}`,
      sql`select id, title, body, category, city, price, created_at from classifieds where author_id = ${me}`,
      sql`select id, body, created_at from posts where author_id = ${me}`,
      sql`select requester_id, addressee_id, status, created_at from friendships where requester_id = ${me} or addressee_id = ${me}`,
      sql`select target_id, created_at from favorites where user_id = ${me}`,
      sql`select blocked_id, created_at from blocks where blocker_id = ${me}`,
      sql`select category, city, created_at from wishes where user_id = ${me}`,
      sql`select kind, target_id, reason, note, created_at from reports where reporter_id = ${me}`,
      sql`select activity_id, created_at from checkins where user_id = ${me}`,
      sql`select c.name from community_members m join communities c on c.id = m.community_id where m.user_id = ${me}`,
      sql`select r.activity_id, r.seats, r.origin, 'fahrer' as rolle from rides r where r.driver_id = ${me} union all select r.activity_id, r.seats, r.origin, 'mitfahrer' as rolle from ride_riders rr join rides r on r.id = rr.ride_id where rr.rider_id = ${me}`,
      sql`select activity_id, question, options, created_at from polls where creator_id = ${me}`,
      sql`select poll_id, option_idx from poll_votes where user_id = ${me}`,
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      konto: account[0] ?? null,
      profil: profile[0] ?? null,
      eigeneTreffen: activities,
      meineAnfragen: requests,
      nachrichtenInTreffen: messages,
      nachrichtenBeiAnzeigen: adMessages,
      bewertungenDieIchGegebenHabe: ratingsGiven,
      bewertungenFuerMich: ratingsReceived[0] ?? null,
      eigeneAnzeigen: classifieds,
      beitraege: posts,
      freundschaften: friends,
      favoriten: favorites,
      blockiert: blocks,
      wuensche: wishes,
      meldungenDieIchGemacht: reports,
      checkIns: checkins,
      communities,
      fahrten: rides,
      abstimmungenDieIchGestartetHabe: polls,
      meineStimmen: votes,
      hinweis: "Nachrichten anderer Personen und deren Profile sind nicht enthalten.",
    };
    return { filename: `meeqo-daten-${new Date().toISOString().slice(0, 10)}.json`, json: JSON.stringify(data, null, 2) };
  });

// ---------------------------------------------------------------------------
// Bedienung: Als Naechstes, Alles gut, Orte, Abstimmung, Mitfahren, Kalender

async function membership(sql: Sql, activityId: string, userId: string) {
  const rows = await sql<{ host_id: string; title: string; starts_at: unknown }>`select host_id, title, starts_at from activities where id = ${activityId} and cancelled = false`;
  const row = rows[0];
  if (!row) throw new Error("Aktivität nicht gefunden.");
  const host = row.host_id === userId;
  const member = host || (await sql`select 1 as ok from join_requests where activity_id = ${activityId} and requester_id = ${userId} and status = 'accepted'`).length > 0;
  if (!member) throw new Error("Das geht erst nach der Zusage.");
  return { host, title: row.title, startsAt: iso(row.starts_at) };
}

async function otherMembers(sql: Sql, activityId: string, exceptId: string) {
  const rows = await sql<{ user_id: string }>`
    select requester_id as user_id from join_requests where activity_id = ${activityId} and status = 'accepted' and requester_id <> ${exceptId}
    union
    select host_id as user_id from activities where id = ${activityId} and host_id <> ${exceptId}
  `;
  return rows.map((row) => row.user_id);
}

export const nextUp = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<NextUp | null> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; title: string; starts_at: unknown; duration_min: number; place_name: string; city: string; lat: number; lng: number;
      host_id: string; spots: number; accepted: number; checked_at: unknown; safe_at: unknown; shared: boolean;
    }>`
      select a.id, a.title, a.starts_at, a.duration_min, a.place_name, a.city, a.lat, a.lng, a.host_id, a.spots,
        (select count(*)::int from join_requests j where j.activity_id = a.id and j.status = 'accepted') as accepted,
        c.created_at as checked_at, c.safe_at,
        exists (select 1 from safety_shares s where s.activity_id = a.id and s.user_id = ${context.userId}) as shared
      from activities a
      left join checkins c on c.activity_id = a.id and c.user_id = ${context.userId}
      where a.cancelled = false
        and (a.host_id = ${context.userId}
          or exists (select 1 from join_requests j where j.activity_id = a.id and j.requester_id = ${context.userId} and j.status = 'accepted'))
        and a.starts_at + make_interval(mins => a.duration_min) > now() - interval '3 hours'
        and a.starts_at < now() + interval '7 days'
      order by a.starts_at asc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const startsAt = iso(row.starts_at);
    const hoursTo = (new Date(startsAt).getTime() - Date.now()) / 3_600_000;
    return {
      id: row.id,
      title: row.title,
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + num(row.duration_min) * 60_000).toISOString(),
      placeName: row.place_name,
      city: row.city,
      lat: num(row.lat),
      lng: num(row.lng),
      hosting: row.host_id === context.userId,
      group: num(row.spots) > 2 || num(row.accepted) >= 2,
      chatOpen: row.host_id !== context.userId || num(row.accepted) > 0,
      checkedIn: Boolean(row.checked_at),
      safe: Boolean(row.safe_at),
      canCheckIn: hoursTo <= 2 && hoursTo >= -12,
      hasSafetyLink: flag(row.shared),
    };
  });

/** After the meetup: "I am home and fine". The trusted person sees it on the link. */
export const confirmSafe = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const done = await sql<{ activity_id: string }>`
      update checkins set safe_at = now() where activity_id = ${data.id} and user_id = ${context.userId} and safe_at is null returning activity_id
    `;
    if (!done.length) {
      const had = await sql`select 1 as ok from checkins where activity_id = ${data.id} and user_id = ${context.userId}`;
      if (!had.length) throw new Error("Erst einchecken, dann Bescheid sagen.");
    }
    return { ok: true as const };
  });

export const suggestVenues = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { lat: number; lng: number }) => ({ lat: Number(input.lat), lng: Number(input.lng) }))
  .handler(async ({ data, context }): Promise<VenueHit[]> => {
    if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng) || Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180) return [];
    const sql = await getSql();
    await throttle(sql, context.userId, "venues", 60, 3600);
    return venuesNear(data.lat, data.lng);
  });

// --- Terminabstimmung

async function loadPolls(sql: Sql, activityId: string, userId: string, isHost: boolean): Promise<PollView[]> {
  const polls = await sql<{ id: string; question: string; options: string; closed: boolean; created_at: unknown; display_name: string | null }>`
    select pl.id, pl.question, pl.options, pl.closed, pl.created_at, p.display_name
    from polls pl left join profiles p on p.user_id = pl.creator_id
    where pl.activity_id = ${activityId} order by pl.created_at asc
  `;
  if (!polls.length) return [];
  const votes = await sql<{ poll_id: string; option_idx: number; user_id: string }>`
    select v.poll_id, v.option_idx, v.user_id from poll_votes v join polls pl on pl.id = v.poll_id where pl.activity_id = ${activityId}
  `;
  return polls.map((poll) => {
    const options = parseList(poll.options);
    const mine = votes.find((vote) => vote.poll_id === poll.id && vote.user_id === userId);
    return {
      id: poll.id,
      question: poll.question,
      options: options.map((at, index) => ({ at, votes: votes.filter((vote) => vote.poll_id === poll.id && num(vote.option_idx) === index).length })),
      mine: mine ? num(mine.option_idx) : null,
      closed: flag(poll.closed),
      createdAt: iso(poll.created_at),
      creatorName: (poll.display_name || "Jemand").split(" ")[0],
      canClose: isHost,
    };
  });
}

export const createPoll = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { activityId: string; question?: string; options: string[] }) => ({
    activityId: clean(input.activityId, 80),
    question: clean(input.question, 80) || "Wann passt es euch?",
    options: Array.isArray(input.options) ? input.options.map((item) => clean(item, 40)).slice(0, 4) : [],
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const member = await membership(sql, data.activityId, context.userId);
    await throttle(sql, context.userId, "poll", 10, 3600);
    const times = [...new Set(data.options.map((item) => new Date(item).getTime()).filter((value) => Number.isFinite(value) && value > Date.now()))];
    if (times.length < 2) throw new Error("Gib mindestens zwei Zeiten in der Zukunft an.");
    const id = crypto.randomUUID();
    await sql`
      insert into polls (id, activity_id, creator_id, question, options)
      values (${id}, ${data.activityId}, ${context.userId}, ${data.question}, ${JSON.stringify(times.sort().map((value) => new Date(value).toISOString()))})
    `;
    bump(data.activityId);
    for (const other of await otherMembers(sql, data.activityId, context.userId)) {
      await notify(sql, other, "poll", "Terminabstimmung", `${member.title}: ${data.question}`, `/chat/${data.activityId}`, id);
    }
    return { id };
  });

export const votePoll = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { pollId: string; optionIdx: number }) => ({ pollId: clean(input.pollId, 80), optionIdx: Math.round(Number(input.optionIdx)) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ activity_id: string; options: string; closed: boolean }>`select activity_id, options, closed from polls where id = ${data.pollId}`;
    const poll = rows[0];
    if (!poll) throw new Error("Abstimmung nicht gefunden.");
    await membership(sql, poll.activity_id, context.userId);
    if (flag(poll.closed)) throw new Error("Die Abstimmung ist beendet.");
    if (!(data.optionIdx >= 0 && data.optionIdx < parseList(poll.options).length)) throw new Error("Diese Zeit gibt es nicht.");
    await sql`
      insert into poll_votes (poll_id, user_id, option_idx) values (${data.pollId}, ${context.userId}, ${data.optionIdx})
      on conflict (poll_id, user_id) do update set option_idx = ${data.optionIdx}
    `;
    bump(poll.activity_id);
    return { ok: true as const };
  });

/** The host ends the vote and can set the winning time as the new start. */
export const closePoll = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { pollId: string; applyIdx?: number }) => ({ pollId: clean(input.pollId, 80), applyIdx: input.applyIdx == null ? null : Math.round(Number(input.applyIdx)) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ activity_id: string; options: string }>`select activity_id, options from polls where id = ${data.pollId}`;
    const poll = rows[0];
    if (!poll) throw new Error("Abstimmung nicht gefunden.");
    const member = await membership(sql, poll.activity_id, context.userId);
    if (!member.host) throw new Error("Nur der Gastgeber beendet die Abstimmung.");
    const options = parseList(poll.options);
    if (data.applyIdx != null) {
      const chosen = options[data.applyIdx];
      if (!chosen || new Date(chosen).getTime() < Date.now()) throw new Error("Diese Zeit ist nicht mehr möglich.");
      await sql`update activities set starts_at = ${chosen} where id = ${poll.activity_id}`;
      await sql`update join_requests set confirmed_at = null where activity_id = ${poll.activity_id}`;
      for (const other of await otherMembers(sql, poll.activity_id, context.userId)) {
        await notify(sql, other, "poll", "Neuer Termin", `${member.title} ist jetzt am ${formatBerlin(chosen)}.`, `/activity/${poll.activity_id}`, data.pollId);
      }
    }
    await sql`update polls set closed = true where id = ${data.pollId}`;
    bump(poll.activity_id);
    return { ok: true as const };
  });

function formatBerlin(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
}

// --- Mitfahren

export const listRides = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { activityId: string }) => ({ activityId: clean(input.activityId, 80) }))
  .handler(async ({ data, context }): Promise<RideView[]> => {
    const sql = await getSql();
    await membership(sql, data.activityId, context.userId);
    const rides = await sql<{ id: string; driver_id: string; seats: number; origin: string; display_name: string | null }>`
      select r.id, r.driver_id, r.seats, r.origin, p.display_name
      from rides r left join profiles p on p.user_id = r.driver_id
      where r.activity_id = ${data.activityId} order by r.created_at asc
    `;
    if (!rides.length) return [];
    const riders = await sql<{ ride_id: string; rider_id: string; display_name: string | null }>`
      select rr.ride_id, rr.rider_id, p.display_name
      from ride_riders rr join rides r on r.id = rr.ride_id left join profiles p on p.user_id = rr.rider_id
      where r.activity_id = ${data.activityId}
    `;
    return rides.map((ride) => {
      const mine = riders.filter((rider) => rider.ride_id === ride.id);
      return {
        id: ride.id,
        driverId: ride.driver_id,
        driverName: (ride.display_name || "Jemand").split(" ")[0],
        seats: num(ride.seats),
        free: Math.max(0, num(ride.seats) - mine.length),
        origin: ride.origin,
        mine: ride.driver_id === context.userId,
        iRide: mine.some((rider) => rider.rider_id === context.userId),
        riders: mine.map((rider) => (rider.display_name || "Jemand").split(" ")[0]),
      };
    });
  });

export const offerRide = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { activityId: string; seats: number; origin?: string }) => ({
    activityId: clean(input.activityId, 80),
    seats: Math.min(6, Math.max(1, Math.round(Number(input.seats)) || 1)),
    origin: clean(input.origin, 60),
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await membership(sql, data.activityId, context.userId);
    await throttle(sql, context.userId, "ride", 20, 3600);
    const existing = await sql<{ id: string; riders: number }>`
      select r.id, (select count(*)::int from ride_riders rr where rr.ride_id = r.id) as riders from rides r where r.activity_id = ${data.activityId} and r.driver_id = ${context.userId}
    `;
    if (existing[0] && num(existing[0].riders) > data.seats) throw new Error("Es fahren schon mehr Leute mit.");
    await sql`
      insert into rides (id, activity_id, driver_id, seats, origin) values (${crypto.randomUUID()}, ${data.activityId}, ${context.userId}, ${data.seats}, ${data.origin})
      on conflict (activity_id, driver_id) do update set seats = ${data.seats}, origin = ${data.origin}
    `;
    await sql`delete from ride_riders where rider_id = ${context.userId} and ride_id in (select id from rides where activity_id = ${data.activityId})`;
    return { ok: true as const };
  });

export const claimRide = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { rideId: string }) => ({ rideId: clean(input.rideId, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ activity_id: string; driver_id: string; seats: number }>`select activity_id, driver_id, seats from rides where id = ${data.rideId}`;
    const ride = rows[0];
    if (!ride) throw new Error("Die Fahrt gibt es nicht mehr.");
    const member = await membership(sql, ride.activity_id, context.userId);
    if (ride.driver_id === context.userId) throw new Error("Das ist deine eigene Fahrt.");
    await sql`delete from ride_riders where rider_id = ${context.userId} and ride_id in (select id from rides where activity_id = ${ride.activity_id})`;
    await sql`insert into ride_riders (ride_id, rider_id) values (${data.rideId}, ${context.userId}) on conflict do nothing`;
    const count = await sql<{ n: number }>`select count(*)::int as n from ride_riders where ride_id = ${data.rideId}`;
    if (num(count[0]?.n) > num(ride.seats)) {
      await sql`delete from ride_riders where ride_id = ${data.rideId} and rider_id = ${context.userId}`;
      throw new Error("Die Fahrt ist voll.");
    }
    const { profile } = await ensureProfile(context.userId);
    await notify(sql, ride.driver_id, "ride", "Jemand fährt mit", `${profile.displayName} fährt zu „${member.title}“ mit dir.`, `/activity/${ride.activity_id}`, data.rideId);
    return { ok: true as const };
  });

export const leaveRide = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { rideId: string }) => ({ rideId: clean(input.rideId, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`delete from ride_riders where ride_id = ${data.rideId} and rider_id = ${context.userId}`;
    return { ok: true as const };
  });

export const cancelRide = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { rideId: string }) => ({ rideId: clean(input.rideId, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; activity_id: string }>`select id, activity_id from rides where id = ${data.rideId} and driver_id = ${context.userId}`;
    if (!rows[0]) throw new Error("Nur du kannst deine Fahrt absagen.");
    const riders = await sql<{ rider_id: string }>`select rider_id from ride_riders where ride_id = ${data.rideId}`;
    await sql`delete from ride_riders where ride_id = ${data.rideId}`;
    await sql`delete from rides where id = ${data.rideId}`;
    for (const rider of riders) await notify(sql, rider.rider_id, "ride", "Fahrt abgesagt", "Deine Mitfahrgelegenheit gibt es nicht mehr.", `/activity/${rows[0].activity_id}`, data.rideId);
    return { ok: true as const };
  });

// --- Kalender abonnieren

async function calendarToken(sql: Sql, userId: string, rotate: boolean) {
  const existing = await sql<{ token: string }>`select token from calendar_tokens where user_id = ${userId}`;
  if (existing[0] && !rotate) return existing[0].token;
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 40);
  await sql`
    insert into calendar_tokens (user_id, token) values (${userId}, ${token})
    on conflict (user_id) do update set token = ${token}, created_at = now()
  `;
  return token;
}

export const getCalendarLink = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { rotate?: boolean }) => ({ rotate: Boolean(input?.rotate) }))
  .handler(async ({ data, context }) => ({ path: `/kalender/${await calendarToken(await getSql(), context.userId, data.rotate)}` }));

// ---------------------------------------------------------------------------
// Treffen bearbeiten

export const updateActivity = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: {
    id: string;
    title: string;
    description: string;
    placeName: string;
    city: string;
    startsAt: string;
    spots: number;
    durationMin: number;
    imageUrl?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const found = await sql<{
      title: string; description: string; place_name: string; city: string; starts_at: unknown; spots: number; duration_min: number; taken: number;
    }>`
      select a.title, a.description, a.place_name, a.city, a.starts_at, a.spots, a.duration_min,
        (select count(*)::int from join_requests j where j.activity_id = a.id and j.status = 'accepted') as taken
      from activities a where a.id = ${data.id} and a.host_id = ${context.userId} and a.cancelled = false
    `;
    const old = found[0];
    if (!old) throw new Error("Nur der Ersteller kann das ändern.");
    if (new Date(iso(old.starts_at)).getTime() < Date.now() - 2 * 60 * 60 * 1000) throw new Error("Das Treffen ist schon vorbei.");
    const title = clean(data.title, 80);
    const description = clean(data.description, 800);
    const placeName = clean(data.placeName, 80);
    const city = clean(data.city, 60);
    const spots = Math.round(Number(data.spots));
    const durationMin = Math.min(480, Math.max(30, Math.round(Number(data.durationMin)) || 120));
    const starts = new Date(data.startsAt);
    if (title.length < 3) throw new Error("Titel fehlt.");
    if (!placeName || !city) throw new Error("Ort und Stadt fehlen.");
    if (Number.isNaN(starts.getTime()) || starts.getTime() < Date.now() - 60 * 60 * 1000) throw new Error("Der Zeitpunkt liegt in der Vergangenheit.");
    if (!Number.isFinite(spots) || spots < 1 || spots > 40) throw new Error("Plätze zwischen 1 und 40.");
    if (spots < num(old.taken)) throw new Error(`Schon ${num(old.taken)} Leute sind dabei. Weniger Plätze geht erst, wenn jemand herausgenommen wird.`);
    let imageUrl = clean(data.imageUrl, 450_000);
    if (imageUrl && !imageUrl.startsWith("/activities/") && !validImage(imageUrl)) throw new Error("Das Foto muss ein JPEG- oder PNG-Bild sein.");
    const timeChanged = starts.getTime() !== new Date(iso(old.starts_at)).getTime();
    const placeChanged = placeName !== old.place_name || city !== old.city;
    if (city !== old.city) {
      const looked = await lookupPlace(city);
      if (!looked) throw new Error("Diese Stadt kenne ich nicht.");
      await sql`update activities set lat = ${looked.lat}, lng = ${looked.lng} where id = ${data.id}`;
    }
    await sql`
      update activities set title = ${title}, description = ${description}, place_name = ${placeName}, city = ${city},
        starts_at = ${starts.toISOString()}, spots = ${spots}, duration_min = ${durationMin}
      where id = ${data.id}
    `;
    if (imageUrl) await sql`update activities set image_url = ${imageUrl} where id = ${data.id}`;
    const changed = [
      title !== old.title ? "Titel" : "",
      timeChanged ? "Zeit" : "",
      placeChanged ? "Ort" : "",
      spots !== num(old.spots) ? "Plätze" : "",
    ].filter(Boolean);
    if (timeChanged) await sql`update join_requests set confirmed_at = null where activity_id = ${data.id}`;
    if (changed.length) {
      for (const other of await otherMembers(sql, data.id, context.userId)) {
        await notify(sql, other, "changed", `Geändert: ${title}`, `Neu: ${changed.join(", ")}.`, `/activity/${data.id}`, data.id);
      }
    }
    if (spots > num(old.spots)) {
      for (let index = 0; index < spots - num(old.spots); index += 1) await promoteWaitlist(sql, data.id);
    }
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Live-Chat: die Anfrage bleibt kurz offen und kommt sofort zurueck, sobald etwas Neues da ist

const LIVE_WAIT_MS = 8000;

async function chatVersion(sql: Sql, kind: "activity" | "ad", id: string) {
  if (kind === "ad") {
    const rows = await sql<{ m: number }>`select count(*)::int as m from classified_messages where thread_id = ${id}`;
    return `${num(rows[0]?.m)}`;
  }
  const rows = await sql<{ m: number; p: number; v: number; c: number }>`
    select
      (select count(*)::int from messages where activity_id = ${id}) as m,
      (select count(*)::int from polls where activity_id = ${id}) as p,
      (select count(*)::int from poll_votes v join polls pl on pl.id = v.poll_id where pl.activity_id = ${id}) as v,
      (select count(*)::int from polls where activity_id = ${id} and closed) as c
  `;
  return `${num(rows[0]?.m)}.${num(rows[0]?.p)}.${num(rows[0]?.v)}.${num(rows[0]?.c)}`;
}

export const waitChat = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; kind: string; version?: string }) => ({
    id: clean(input.id, 80),
    kind: input.kind === "ad" ? ("ad" as const) : ("activity" as const),
    version: clean(input.version, 40),
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    if (data.kind === "ad") await assertAdThread(sql, data.id, context.userId);
    else await assertChat(sql, data.id, context.userId);
    const deadline = Date.now() + LIVE_WAIT_MS;
    let version = await chatVersion(sql, data.kind, data.id);
    while (version === data.version && data.version !== "" && Date.now() < deadline) {
      await waitBump(data.id, Math.min(2500, Math.max(200, deadline - Date.now())));
      version = await chatVersion(sql, data.kind, data.id);
    }
    return { version, changed: version !== data.version };
  });
