import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { clean, ensureProfile, flag, iso, memberMiddleware, notify, num, requireAdmin, throttle, validImage } from "@/lib/meeqo/api";

// ---------------------------------------------------------------------------
// Selfie-Prüfung (Admin vergleicht mit dem Profilfoto, Selfie wird danach gelöscht)

export type SelfieStatus = { status: "none" | "pending" | "approved" | "declined"; verified: boolean };

export const mySelfie = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<SelfieStatus> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const rows = await sql<{ status: string }>`select status from selfie_checks where user_id = ${context.userId}`;
    const status = rows[0]?.status;
    return { status: status === "pending" || status === "approved" || status === "declined" ? status : "none", verified: profile.identityConfirmed };
  });

export const submitSelfie = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { image: string }) => ({ image: String(input?.image ?? "").slice(0, 600_000) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!profile.avatarUrl) throw new Error("Lade zuerst ein Profilfoto hoch. Das Selfie wird damit verglichen.");
    if (profile.identityConfirmed) throw new Error("Dein Profil ist schon bestätigt.");
    if (!validImage(data.image)) throw new Error("Das Bild ging nicht. Nimm ein JPEG oder PNG.");
    await throttle(sql, context.userId, "selfie", 3, 86_400);
    await sql`
      insert into selfie_checks (user_id, image, status) values (${context.userId}, ${data.image}, 'pending')
      on conflict (user_id) do update set image = ${data.image}, status = 'pending', created_at = now(), reviewed_at = null
    `;
    return { ok: true as const };
  });

export type SelfieReview = { userId: string; name: string; avatarUrl: string; selfie: string; createdAt: string };

export const adminSelfies = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<SelfieReview[]> => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const rows = await sql<{ user_id: string; display_name: string; avatar_url: string; image: string; created_at: unknown }>`
      select s.user_id, p.display_name, p.avatar_url, s.image, s.created_at
      from selfie_checks s join profiles p on p.user_id = s.user_id
      where s.status = 'pending' order by s.created_at limit 30
    `;
    return rows.map((row) => ({ userId: row.user_id, name: row.display_name, avatarUrl: row.avatar_url, selfie: row.image, createdAt: iso(row.created_at) }));
  });

export const reviewSelfie = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { userId: string; ok: boolean }) => ({ userId: clean(input.userId, 80), ok: Boolean(input.ok) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    // The selfie itself is deleted with the decision; only the result stays.
    const done = await sql<{ user_id: string }>`
      update selfie_checks set status = ${data.ok ? "approved" : "declined"}, image = '', reviewed_at = now()
      where user_id = ${data.userId} and status = 'pending' returning user_id
    `;
    if (!done.length) throw new Error("Schon erledigt.");
    if (data.ok) {
      await sql`update profiles set identity_confirmed = true where user_id = ${data.userId}`;
      await notify(sql, data.userId, "verified", "Verifiziert", "Dein Selfie passt zu deinem Profilfoto. Andere sehen jetzt „Verifiziert“.", "/profile", "selfie");
    } else {
      await notify(sql, data.userId, "verified", "Selfie passt nicht", "Wir konnten Selfie und Profilfoto nicht zuordnen. Versuch es mit einem klaren Foto von vorn.", "/profile", "selfie");
    }
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Nach dem Treffen: war da, war nett, nochmal mit der Gruppe, Gruppe behalten

export type AfterMeet = {
  title: string;
  isHost: boolean;
  started: boolean;
  checkedIn: boolean;
  mine: { wasThere: boolean; wasNice: boolean | null; againGroup: boolean | null; keepGroup: boolean; hostThere: boolean | null } | null;
  keepCount: number;
  groupId: string | null;
  people: number;
};

async function belongsTo(sql: Sql, activityId: string, userId: string) {
  const rows = await sql<{ host_id: string; title: string; starts_at: unknown; category: string; city: string }>`
    select host_id, title, starts_at, category, city from activities where id = ${activityId} and cancelled = false
  `;
  const act = rows[0];
  if (!act) throw new Error("Aktivität nicht gefunden.");
  const isHost = act.host_id === userId;
  const guest = isHost ? [] : await sql`select 1 as ok from join_requests where activity_id = ${activityId} and requester_id = ${userId} and status = 'accepted'`;
  if (!isHost && !guest.length) throw new Error("Aktivität nicht gefunden.");
  return { ...act, isHost };
}

export const getAfterMeet = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }): Promise<AfterMeet> => {
    const sql = await getSql();
    const act = await belongsTo(sql, data.id, context.userId);
    const [mine, keep, group, checked, people] = await Promise.all([
      sql<{ was_there: boolean; was_nice: boolean | null; again_group: boolean | null; keep_group: boolean; host_there: boolean | null }>`
        select was_there, was_nice, again_group, keep_group, host_there from meet_feedback where activity_id = ${data.id} and user_id = ${context.userId}`,
      sql<{ n: number }>`select count(*)::int as n from meet_feedback where activity_id = ${data.id} and keep_group = true`,
      sql<{ id: string }>`select c.id from communities c join community_members m on m.community_id = c.id and m.user_id = ${context.userId} where c.from_activity = ${data.id}`,
      sql`select 1 as ok from checkins where activity_id = ${data.id} and user_id = ${context.userId}`,
      sql<{ n: number }>`select count(*)::int + 1 as n from join_requests where activity_id = ${data.id} and status = 'accepted'`,
    ]);
    const row = mine[0];
    return {
      title: act.title,
      isHost: act.isHost,
      started: new Date(iso(act.starts_at)).getTime() <= Date.now(),
      checkedIn: checked.length > 0,
      mine: row ? { wasThere: flag(row.was_there), wasNice: row.was_nice, againGroup: row.again_group, keepGroup: flag(row.keep_group), hostThere: row.host_there } : null,
      keepCount: num(keep[0]?.n),
      groupId: group[0]?.id ?? null,
      people: num(people[0]?.n),
    };
  });

export const saveAfterMeet = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; wasThere: boolean; wasNice?: boolean | null; againGroup?: boolean | null; keepGroup?: boolean; hostThere?: boolean | null }) => ({
    id: clean(input.id, 80),
    wasThere: Boolean(input.wasThere),
    wasNice: typeof input.wasNice === "boolean" ? input.wasNice : null,
    againGroup: typeof input.againGroup === "boolean" ? input.againGroup : null,
    keepGroup: Boolean(input.keepGroup),
    hostThere: typeof input.hostThere === "boolean" ? input.hostThere : null,
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const act = await belongsTo(sql, data.id, context.userId);
    if (new Date(iso(act.starts_at)).getTime() > Date.now()) throw new Error("Das geht erst, wenn das Treffen angefangen hat.");
    const hostThere = act.isHost ? null : data.hostThere;
    await sql`
      insert into meet_feedback (activity_id, user_id, was_there, was_nice, again_group, keep_group, host_there)
      values (${data.id}, ${context.userId}, ${data.wasThere}, ${data.wasNice}, ${data.againGroup}, ${data.keepGroup && data.wasThere}, ${hostThere})
      on conflict (activity_id, user_id) do update set was_there = ${data.wasThere}, was_nice = ${data.wasNice}, again_group = ${data.againGroup},
        keep_group = ${data.keepGroup && data.wasThere}, host_there = ${hostThere}
    `;
    let groupId: string | null = null;
    if (data.keepGroup && data.wasThere) {
      // A private group only from people who each said yes. Nobody is added without their own yes.
      const yes = await sql<{ user_id: string }>`select user_id from meet_feedback where activity_id = ${data.id} and keep_group = true`;
      const existing = await sql<{ id: string }>`select id from communities where from_activity = ${data.id}`;
      if (existing[0]) {
        groupId = existing[0].id;
        await sql`insert into community_members (community_id, user_id) values (${groupId}, ${context.userId}) on conflict do nothing`;
      } else if (yes.length >= 2) {
        groupId = crypto.randomUUID();
        await sql`
          insert into communities (id, owner_id, name, topic, city, description, from_activity, private)
          values (${groupId}, ${context.userId}, ${act.title.slice(0, 60)}, ${act.category}, ${act.city}, ${"Aus dem Treffen. Nur für alle, die die Gruppe behalten wollten."}, ${data.id}, true)
        `;
        for (const person of yes) {
          await sql`insert into community_members (community_id, user_id) values (${groupId}, ${person.user_id}) on conflict do nothing`;
          if (person.user_id !== context.userId) await notify(sql, person.user_id, "group", "Eure Gruppe bleibt", `„${act.title}“ ist jetzt eine private Gruppe.`, `/communities/${groupId}`, groupId);
        }
      }
    }
    return { ok: true as const, groupId };
  });

/** Discreet host reliability: only from guests who were there, only with at least 3 such meetups. */
export const hostReliability = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { hostId: string }) => ({ hostId: clean(input.hostId, 80) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; missed: number; seen: number }>`
      select a.id,
        count(*) filter (where f.host_there = false)::int as missed,
        count(*) filter (where f.host_there is not null)::int as seen
      from activities a join meet_feedback f on f.activity_id = a.id and f.user_id <> a.host_id and f.was_there = true
      where a.host_id = ${data.hostId} and a.cancelled = false and a.starts_at < now()
      group by a.id
    `;
    const rated = rows.filter((row) => num(row.seen) > 0);
    // A meetup counts as missed when most guests who answered say the host was not there.
    const missed = rated.filter((row) => num(row.missed) * 2 > num(row.seen)).length;
    const nice = await sql<{ n: number }>`
      select count(*)::int as n from meet_feedback f join activities a on a.id = f.activity_id
      where a.host_id = ${data.hostId} and f.user_id <> a.host_id and f.was_nice = true
    `;
    return { reliability: rated.length >= 3 ? { meetups: rated.length, missed } : null, nice: num(nice[0]?.n) };
  });

// ---------------------------------------------------------------------------
// Profil vervollständigen (optional) und Mitteilungen

export const saveProfileMore = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { bio?: string; seeking?: string[]; languages?: string[]; skip?: boolean }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { sql } = await ensureProfile(context.userId);
    if (data.skip) {
      await sql`update profiles set profile_more_seen = true where user_id = ${context.userId}`;
      return { ok: true as const };
    }
    const bio = clean(data.bio ?? "", 280);
    const seeking = Array.isArray(data.seeking) ? data.seeking.map((item) => clean(item, 48)).filter(Boolean).slice(0, 12) : null;
    const languages = Array.isArray(data.languages) ? data.languages.map((item) => clean(item, 24)).filter(Boolean).slice(0, 8) : [];
    if (seeking) {
      await sql`update profiles set bio = ${bio}, seeking = ${JSON.stringify(seeking)}, languages = ${JSON.stringify(languages)}, profile_more_seen = true where user_id = ${context.userId}`;
    } else {
      await sql`update profiles set bio = ${bio}, languages = ${JSON.stringify(languages)}, profile_more_seen = true where user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

export const setNotifyPrefs = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { reminder?: boolean; nearby?: boolean }) => input ?? {})
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    if (typeof data.reminder === "boolean") await sql`update profiles set notify_reminder = ${data.reminder} where user_id = ${context.userId}`;
    if (typeof data.nearby === "boolean") await sql`update profiles set notify_nearby = ${data.nearby} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Orte aus der Recherche: Vorlagen für Admins

export type Venue = { id: string; name: string; kind: string; address: string; district: string; website: string; idea: string };

export const listVenues = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async (): Promise<Venue[]> => {
    const sql = await getSql();
    return sql<Venue>`select id, name, kind, address, district, website, idea from venues order by kind, name`;
  });
