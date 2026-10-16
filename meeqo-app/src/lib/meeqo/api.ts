import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { kmBetween, cityCoords, matchCities } from "@/lib/meeqo/geo";
import { MOODS } from "@/lib/meeqo/labels";
import { lookupPlace, plzChoices, plzPoint } from "@/lib/meeqo/places";
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

type ProfileRow = {
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
) {
  const badges: string[] = [];
  if (identity) badges.push("Profil bestätigt");
  if (organizer) badges.push("Veranstalter");
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

async function ratingStats(sql: Sql, userId: string) {
  const rows = await sql<{ n: number; punctual: number | null; respectful: number | null; matches: number | null }>`
    select count(*)::int as n, avg(punctual) as punctual, avg(respectful) as respectful, avg(matches_profile) as matches
    from ratings where ratee_id = ${userId}
  `;
  const row = rows[0];
  return {
    n: num(row?.n),
    punctual: num(row?.punctual),
    respectful: num(row?.respectful),
    matches: num(row?.matches),
  };
}

function mapProfile(row: ProfileRow, stats: { n: number; punctual: number; respectful: number; matches: number }): Profile {
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
    avatarUrl: row.avatar_url || "",
    badges: badgesFrom(
      flag(row.identity_confirmed),
      flag(row.is_organizer),
      stats.n,
      stats.punctual,
      stats.respectful,
      stats.matches,
    ),
    theme: readTheme(row.theme),
  };
}

async function ensureProfile(userId: string) {
  const sql = await getSql();
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
  const status = row.my_status === "pending" || row.my_status === "accepted" || row.my_status === "declined" ? row.my_status : null;
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
    ),
    hostOrganizer: flag(row.is_organizer),
    area: row.area === "business" ? "business" : row.area === "event" ? "event" : "meetup",
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
    imageUrl: row.image_url,
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

async function loadRows(sql: Sql, userId: string) {
  return sql<ActRow>`
    select a.id, a.host_id, a.title, a.description, a.category, a.intent,
      a.place_name, a.city, a.lat, a.lng, a.starts_at, a.spots, a.image_url,
      a.booking_mode, a.community_id, a.public_place, a.cancelled, a.area, a.traits, a.visibility, a.audience_ids,
      p.display_name, p.avatar_url, p.is_organizer, p.identity_confirmed, p.traits as host_traits, p.birth_year as host_birth_year,
      coalesce(r.n, 0) as rating_n, r.punctual, r.respectful, r.matches,
      coalesce(acc.taken, 0) as taken,
      jr.status as my_status
    from activities a
    join profiles p on p.user_id = a.host_id
    left join (
      select ratee_id, count(*)::int as n,
        avg(punctual) as punctual, avg(respectful) as respectful, avg(matches_profile) as matches
      from ratings group by ratee_id
    ) r on r.ratee_id = a.host_id
    left join (
      select activity_id, count(*)::int as taken
      from join_requests where status = 'accepted' group by activity_id
    ) acc on acc.activity_id = a.id
    left join join_requests jr on jr.activity_id = a.id and jr.requester_id = ${userId}
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
  const friendRows = await sql<{ other: string }>`
    select case when requester_id = ${userId} then addressee_id else requester_id end as other
    from friendships
    where status = 'accepted' and (requester_id = ${userId} or addressee_id = ${userId})
  `;
  const communityRows = await sql<{ community_id: string }>`
    select community_id from community_members where user_id = ${userId}
  `;
  const peopleRows = await sql<{ user_id: string }>`
    select distinct m2.user_id as user_id
    from community_members m1
    join community_members m2 on m2.community_id = m1.community_id and m2.user_id <> ${userId}
    where m1.user_id = ${userId}
  `;
  const eventRows = await sql<{ user_id: string }>`
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
  `;
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
  await sql`
    insert into notifications (id, user_id, kind, title, body, href, ref_id)
    values (${crypto.randomUUID()}, ${userId}, ${kind}, ${title}, ${body}, ${href}, ${refId})
  `;
}

function areaOf(category: string, organizer: boolean) {
  if (category === "Business" || category.startsWith("Business · ")) return "business";
  return organizer ? "event" : "meetup";
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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

export const confirmIdentity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update profiles set identity_confirmed = true where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const setNotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { enabled: boolean }) => ({ enabled: Boolean(input.enabled) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`update profiles set notify_push = ${data.enabled} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const setRequireTraits = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { traits: string[] }) => ({
    traits: Array.isArray(input.traits) ? input.traits.map((item) => clean(item, 40)).filter(Boolean).slice(0, 12) : [],
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`update profiles set require_traits = ${JSON.stringify(data.traits)} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const setRadius = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { radiusKm: number }) => input)
  .handler(async ({ data, context }) => {
    const radius = Number(data.radiusKm);
    if (![5, 10, 25, 40, 60, 100].includes(radius)) throw new Error("Radius ungültig.");
    const sql = await getSql();
    await sql`update profiles set radius_km = ${radius} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const hideActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`
      delete from hidden_activities where user_id = ${context.userId} and activity_id = ${data.id}
    `;
    return { ok: true as const };
  });

export const listHidden = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ActivityCard[]> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const hidden = await hiddenSet(sql, context.userId);
    const origin = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const rows = await loadRows(sql, context.userId);
    return rows.map((row) => mapActivity(row, context.userId, origin)).filter((item) => hidden.has(item.id));
  });

export const registerOrganizer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
};

function searchPlace(data: FeedInput) {
  const explicit = clean(data.city, 60);
  if (explicit) return explicit;
  const q = clean(data.q, 80);
  if (q && cityCoords(q)) return q;
  return "";
}

export const getFeed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: FeedInput) => input ?? {})
  .handler(async ({ data, context }): Promise<FeedResult> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const hidden = await hiddenSet(sql, context.userId);
    const audience = await audienceOf(sql, context.userId, profile.birthYear);
    const rows = await loadRows(sql, context.userId);
    const place = searchPlace(data);
    const looked = place ? await lookupPlace(place) : null;
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
    const mapped = rows.map((row) => mapActivity(row, context.userId, origin));
    const pool = mapped.filter((item) => {
      if (item.cancelled) return false;
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
    const matched = days.length ? base.filter((item) => days.includes(berlinDay(item.startsAt))) : base;
    const againRows = await sql<{ title: string }>`
      select a.title from checkins c
      join activities a on a.id = c.activity_id
      where c.user_id = ${context.userId}
        and c.created_at <= now() - interval '5 days'
        and c.created_at >= now() - interval '12 days'
      order by c.created_at desc
      limit 1
    `;
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
      return { items: named, missed: 0, hasLocation: true, around: place, ...hint(named) };
    }
    if (!origin || data.mineOnly) return { items: matched, missed: 0, hasLocation: Boolean(origin), around: place || undefined, ...hint(matched) };
    const near = matched.filter((item) => item.km != null && item.km <= radius);
    const missed = matched.filter((item) => item.km != null && item.km > radius && item.km <= 120).length;
    near.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return { items: near, missed, hasLocation: true, around: place || undefined, ...hint(near) };
  });

export const getActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<ActivityDetail> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const rows = await loadRows(sql, context.userId);
    const origin = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const row = rows.find((item) => item.id === data.id);
    if (!row) throw new Error("Aktivität nicht gefunden.");
    const activity = mapActivity(row, context.userId, origin);
    const audience = await audienceOf(sql, context.userId, profile.birthYear);
    if (!sees(activity.visibility, activity.hostId, activity.communityId, activity.hostBirthYear, audience, activity.isHost || Boolean(activity.myStatus), activity.audienceIds)) {
      throw new Error("Das siehst du mit den Einstellungen dieser Person nicht.");
    }
    if (!activity.isHost && !activity.myStatus && !canSeeActivity(profile.areas, profile.openTo, activity.intent, activity.category)) {
      throw new Error("Diese Aktivität siehst du mit deiner Absicht nicht.");
    }
    const hidden = await hiddenSet(sql, context.userId);
    const checks = await sql<{ user_id: string }>`
      select user_id from checkins where activity_id = ${activity.id} and user_id = ${context.userId}
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
    return { activity, checkedIn: checks.length > 0, rated: ratedHost, mutual, iWantAgain, hidden: hidden.has(activity.id) };
  });

export const createActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
  }) => input)
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
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
    if (imageUrl && !imageUrl.startsWith("data:image/jpeg") && !imageUrl.startsWith("data:image/png") && !imageUrl.startsWith("/activities/")) {
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
        starts_at, spots, image_url, booking_mode, community_id, public_place, traits, visibility, audience_ids, area
      ) values (
        ${id}, ${context.userId}, ${title}, ${description}, ${category}, ${intent}, ${placeName}, ${city},
        ${lat}, ${lng}, ${starts.toISOString()}, ${spots}, ${imageUrl}, ${booking},
        nullif(${communityId}, ''), ${publicPlace}, ${JSON.stringify(activityTraits)}, ${visibility}, ${JSON.stringify(audienceIds)},
        ${areaOf(category, profile.isOrganizer)}
      )
    `;
    return { id };
  });

export const cancelActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .validator((input: { id: string; mood?: string }) => ({
    id: clean(input.id, 80),
    mood: (MOODS as readonly string[]).includes(input.mood ?? "") ? (input.mood as string) : "",
  }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!profile.onboardingDone) throw new Error("Schließ zuerst das Onboarding ab.");
    if (!profile.avatarUrl) throw new Error("Ohne Foto kannst du nicht anfragen. Lad eins im Profil hoch.");
    const rows = await loadRows(sql, context.userId);
    const row = rows.find((item) => item.id === data.id);
    if (!row) throw new Error("Aktivität nicht gefunden.");
    const activity = mapActivity(row, context.userId, null);
    if (activity.cancelled) throw new Error("Die Aktivität ist abgesagt.");
    if (activity.isHost) throw new Error("Das ist deine eigene Aktivität.");
    if (!canSeeActivity(profile.areas, profile.openTo, activity.intent, activity.category)) throw new Error("Diese Aktivität passt nicht zu deiner Absicht.");
    if (activity.myStatus === "pending" || activity.myStatus === "accepted") return { status: activity.myStatus };
    if (activity.spotsLeft < 1) throw new Error("Keine Plätze mehr frei.");
    if (activity.intent === "date" && activity.spots <= 2 && !activity.publicPlace && !activity.hostOrganizer) {
      throw new Error("Dieses Date ist nicht an einem öffentlichen Ort.");
    }
    const status = activity.bookingMode === "instant" ? "accepted" : "pending";
    const id = crypto.randomUUID();
    await sql`
      insert into join_requests (id, activity_id, requester_id, status, mood)
      values (${id}, ${activity.id}, ${context.userId}, ${status}, ${data.mood})
      on conflict (activity_id, requester_id) do update set status = ${status}, mood = ${data.mood}
    `;
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

export const respondRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
    await sql`update join_requests set status = ${status} where id = ${data.id}`;
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
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<RequestItem[]> => {
    const sql = await getSql();
    const incoming = await sql<{ id: string; activity_id: string; title: string; display_name: string; status: string; created_at: unknown; mood: string }>`
      select j.id, j.activity_id, a.title, p.display_name, j.status, j.created_at, j.mood
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
        direction: "out" as const,
      })),
    ];
  });

export const listChats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ChatThread[]> => {
    const sql = await getSql();
    const rows = await sql<{ id: string; title: string; starts_at: unknown; host_id: string; host_name: string; host_avatar: string; spots: number }>`
      select a.id, a.title, a.starts_at, a.host_id, a.spots, p.display_name as host_name, p.avatar_url as host_avatar
      from activities a
      join profiles p on p.user_id = a.host_id
      where a.cancelled = false and (
        exists (select 1 from join_requests j where j.activity_id = a.id and j.requester_id = ${context.userId} and j.status = 'accepted')
        or (a.host_id = ${context.userId} and exists (select 1 from join_requests j where j.activity_id = a.id and j.status = 'accepted'))
      )
      order by a.starts_at asc
    `;
    const threads: ChatThread[] = [];
    for (const row of rows) {
      const last = await sql<{ body: string }>`
        select body from messages where activity_id = ${row.id} order by created_at desc limit 1
      `;
      let peer = row.host_name;
      let peerAvatar = row.host_avatar || "";
      let names = 1;
      if (row.host_id === context.userId) {
        const guests = await sql<{ display_name: string; avatar_url: string }>`
          select p.display_name, p.avatar_url from join_requests j
          join profiles p on p.user_id = j.requester_id
          where j.activity_id = ${row.id} and j.status = 'accepted'
        `;
        names = guests.length + 1;
        peer = guests.map((guest) => guest.display_name).join(", ") || "Noch niemand";
        peerAvatar = guests.find((guest) => guest.avatar_url)?.avatar_url || "";
      } else {
        const guests = await sql<{ n: number }>`select count(*)::int as n from join_requests where activity_id = ${row.id} and status = 'accepted'`;
        names = num(guests[0]?.n) + 1;
      }
      threads.push({
        activityId: row.id,
        title: row.title,
        startsAt: iso(row.starts_at),
        lastBody: last[0]?.body ?? "Noch keine Nachricht",
        peerName: peer,
        peerAvatar,
        group: names >= 3 || num(row.spots) > 2,
        kind: "activity",
      });
    }
    const adRows = await sql<{ id: string; title: string; buyer_id: string; seller_id: string; display_name: string | null; avatar_url: string | null; created_at: unknown }>`
      select t.id, c.title, t.buyer_id, t.seller_id, p.display_name, p.avatar_url, t.created_at
      from classified_threads t
      join classifieds c on c.id = t.classified_id
      left join profiles p on p.user_id = case when t.buyer_id = ${context.userId} then t.seller_id else t.buyer_id end
      where t.buyer_id = ${context.userId} or t.seller_id = ${context.userId}
      order by t.created_at desc
    `;
    for (const row of adRows) {
      const last = await sql<{ body: string }>`select body from classified_messages where thread_id = ${row.id} order by created_at desc limit 1`;
      threads.push({
        activityId: row.id,
        title: row.title,
        startsAt: iso(row.created_at),
        lastBody: last[0]?.body ?? "Noch keine Nachricht",
        peerName: row.display_name || "Jemand",
        peerAvatar: row.avatar_url || "",
        group: false,
        kind: "ad",
      });
    }
    return threads;
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
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<{ title: string; group: boolean; people: ChatPerson[]; messages: ChatMessage[] }> => {
    const sql = await getSql();
    const activity = await assertChat(sql, data.id, context.userId);
    const rows = await sql<{ id: string; sender_id: string; body: string; created_at: unknown; display_name: string | null; avatar_url: string | null }>`
      select m.id, m.sender_id, m.body, m.created_at, p.display_name, p.avatar_url
      from messages m
      left join profiles p on p.user_id = m.sender_id
      where m.activity_id = ${data.id}
      order by m.created_at asc
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
    return {
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
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 1000) }))
  .handler(async ({ data, context }) => {
    if (data.body.length < 1) throw new Error("Nachricht ist leer.");
    const sql = await getSql();
    const activity = await assertChat(sql, data.id, context.userId);
    await sql`
      insert into messages (id, activity_id, sender_id, body)
      values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${data.body})
    `;
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
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{ host_id: string; title: string }>`select host_id, title from activities where id = ${data.id}`;
    const row = rows[0];
    if (!row) throw new Error("Aktivität nicht gefunden.");
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update notifications set read = true where user_id = ${context.userId} and read = false`;
    return { ok: true as const };
  });

export const getPublicProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<PublicProfile> => {
    await ensureProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<ProfileRow>`select * from profiles where user_id = ${data.id}`;
    const row = rows[0];
    if (!row || !flag(row.onboarding_done)) throw new Error("Profil noch nicht da.");
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
      ),
      avatarUrl: row.avatar_url || "",
      friend: await friendState(sql, context.userId, row.user_id),
      favorite: (await sql`select 1 as ok from favorites where user_id = ${context.userId} and target_id = ${row.user_id}`).length > 0,
    };
  });

export const setAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { imageUrl: string }) => ({ imageUrl: clean(input.imageUrl, 450_000) }))
  .handler(async ({ data, context }) => {
    const imageUrl = data.imageUrl;
    if (!imageUrl.startsWith("data:image/jpeg") && !imageUrl.startsWith("data:image/png")) throw new Error("Das Foto muss ein Bild sein.");
    const sql = await getSql();
    await sql`update profiles set avatar_url = ${imageUrl} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql`delete from posts where id = ${data.id} and author_id = ${context.userId} returning id`;
    if (!rows.length) throw new Error("Nur eigene Beiträge lassen sich löschen.");
    return { ok: true as const };
  });

export const listCommunities = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; name: string; parent: string | null }>`
      select id, name, parent from custom_categories where user_id = ${context.userId} order by parent, name
    `;
    return rows.map((row) => ({ id: row.id, name: row.name, parent: row.parent ?? "" }));
  });

export const addCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update profiles set theme = '' where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const suggestActivities = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
      .filter((item) => covers([...item.traits, ...item.authorTraits], profile.requireTraits) && sees(item.visibility, item.authorId, null, item.authorYear, audience, item.mine, item.audienceIds))
      .map(({ authorTraits: _authorTraits, authorYear: _year, visibility: _visibility, audienceIds: _ids, ...item }) => ({
        ...item,
        interested: item.mine ? num(counts.get(item.id)) : 0,
        myThread: threads.get(item.id) ?? null,
      }));
}

export const listClassifieds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Classified[]> => loadClassifieds(context.userId));

export const createClassified = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; body: string; category: string; city: string; price?: string; traits?: string[]; visibility?: string; communityIds?: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
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
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => ({ userId: clean(input.userId, 80) }))
  .handler(async ({ data, context }) => {
    if (!data.userId || data.userId === context.userId) throw new Error("Das geht nicht.");
    const { sql, profile } = await ensureProfile(context.userId);
    const other = await sql<ProfileRow>`select * from profiles where user_id = ${data.userId}`;
    if (!other[0] || !flag(other[0].onboarding_done)) throw new Error("Profil noch nicht da.");
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .validator((input: { id: string; body?: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 500) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!profile.avatarUrl) throw new Error("Ohne Foto kannst du nicht anfragen. Lad eins im Profil hoch.");
    const ad = (await loadClassifieds(context.userId)).find((item) => item.id === data.id);
    if (!ad) throw new Error("Anzeige nicht gefunden.");
    if (ad.mine) throw new Error("Das ist deine eigene Anzeige.");
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
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<AdChat> => {
    const sql = await getSql();
    const thread = await assertAdThread(sql, data.id, context.userId);
    const seller = thread.seller_id === context.userId;
    const peerId = seller ? thread.buyer_id : thread.seller_id;
    const peer = await sql<{ display_name: string | null; avatar_url: string | null }>`select display_name, avatar_url from profiles where user_id = ${peerId}`;
    const rows = await sql<{ id: string; sender_id: string; body: string; created_at: unknown; display_name: string | null; avatar_url: string | null }>`
      select m.id, m.sender_id, m.body, m.created_at, p.display_name, p.avatar_url
      from classified_messages m left join profiles p on p.user_id = m.sender_id
      where m.thread_id = ${data.id} order by m.created_at asc
    `;
    return {
      title: thread.title,
      price: thread.price,
      city: thread.city,
      category: thread.category,
      seller,
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
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 1000) }))
  .handler(async ({ data, context }) => {
    if (data.body.length < 1) throw new Error("Nachricht ist leer.");
    const sql = await getSql();
    const thread = await assertAdThread(sql, data.id, context.userId);
    await sql`
      insert into classified_messages (id, thread_id, sender_id, body)
      values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${data.body})
    `;
    const other = thread.seller_id === context.userId ? thread.buyer_id : thread.seller_id;
    await notify(sql, other, "ad", thread.title, data.body, `/chat/anzeige/${data.id}`, data.id);
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Treffen wiederholen

export const repeatActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const found = await sql<{ starts_at: unknown; cancelled: boolean }>`select starts_at, cancelled from activities where id = ${data.id} and host_id = ${context.userId}`;
    if (!found.length) throw new Error("Nur der Ersteller kann ein Treffen wiederholen.");
    const week = 7 * 24 * 60 * 60 * 1000;
    let next = new Date(iso(found[0].starts_at)).getTime() + week;
    while (next < Date.now() + 60 * 60 * 1000) next += week;
    const id = crypto.randomUUID();
    await sql`
      insert into activities (
        id, host_id, title, description, category, intent, place_name, city, lat, lng,
        starts_at, spots, image_url, booking_mode, community_id, public_place, traits, visibility, audience_ids, area
      )
      select ${id}, host_id, title, description, category, intent, place_name, city, lat, lng,
        ${new Date(next).toISOString()}, spots, image_url, booking_mode, community_id, public_place, traits, visibility, audience_ids, area
      from activities where id = ${data.id} and host_id = ${context.userId}
    `;
    return { id };
  });

// ---------------------------------------------------------------------------
// Lust auf ein Treffen, das es noch nicht gibt

const WISH_AT = 3;

function wishCategory(value: unknown) {
  return clean(value, 48) || "Treffen";
}

export const wishInfo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .validator((input: { category: string; day?: string }) => ({ category: wishCategory(input.category), day: clean(input.day, 10) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!profile.city) throw new Error("Stell zuerst deinen Ort ein.");
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
  .middleware([authMiddleware])
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
    const rows = await sql<{ title: string; starts_at: unknown; place_name: string; city: string; display_name: string | null; checked: unknown }>`
      select a.title, a.starts_at, a.place_name, a.city, p.display_name,
        (select c.created_at from checkins c where c.activity_id = a.id and c.user_id = s.user_id) as checked
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
      state: checkedInAt ? "ok" : late > 0 ? "late" : "waiting",
      minutesLate: checkedInAt ? 0 : Math.max(0, late),
    };
  });

// ---------------------------------------------------------------------------
// Wieder getroffen: nur gegenseitiges Ja

export const listCircle = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
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
