import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { clean, ensureProfile, friendState, iso, memberMiddleware, notify, num, parseList, throttle } from "@/lib/meeqo/api";
import { berlinDay } from "@/lib/meeqo/labels";

async function memberOf(sql: Sql, activityId: string, userId: string) {
  const rows = await sql<{ host_id: string; title: string; starts_at: unknown; visibility: string; cancelled: boolean }>`
    select host_id, title, starts_at, visibility, cancelled from activities where id = ${activityId}
  `;
  const act = rows[0];
  if (!act) throw new Error("Aktivität nicht gefunden.");
  const member = act.host_id === userId
    || (await sql`select 1 as ok from join_requests where activity_id = ${activityId} and requester_id = ${userId} and status = 'accepted'`).length > 0;
  return { ...act, member };
}

// ---------------------------------------------------------------------------
// Stadt: echte Zahlen, ohne Seed-Konten

export type CityPulse = { city: string; running: number; today: number };

export const cityPulse = createServerFn({ method: "GET" })
  .validator((input: { city?: string } | undefined) => ({ city: clean(input?.city || "Karlsruhe", 60) }))
  .handler(async ({ data }): Promise<CityPulse> => {
    const sql = await getSql();
    const day = berlinDay();
    const rows = await sql<{ starts_at: unknown; duration_min: number }>`
      select starts_at, duration_min from activities
      where cancelled = false and visibility = 'all' and host_id not like 'seed:%' and lower(city) = lower(${data.city})
        and starts_at > now() - interval '12 hours' and starts_at < now() + interval '30 hours'
    `;
    const now = Date.now();
    let running = 0;
    let today = 0;
    for (const row of rows) {
      const start = new Date(iso(row.starts_at)).getTime();
      const end = start + (num(row.duration_min) || 120) * 60_000;
      if (start <= now && end > now) running += 1;
      else if (start > now && berlinDay(iso(row.starts_at)) === day) today += 1;
    }
    return { city: data.city, running, today };
  });

// ---------------------------------------------------------------------------
// Gruppenchemie: nur gemeinsame Interessen als Zahlen, keine Namen

export const groupChemistry = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const act = await memberOf(sql, data.id, context.userId);
    if (!act.member && (act.visibility !== "all" || act.cancelled)) return null;
    const rows = await sql<{ user_id: string; seeking: string }>`
      select p.user_id, p.seeking from profiles p
      where p.user_id = ${act.host_id} or p.user_id = ${context.userId}
        or p.user_id in (select requester_id from join_requests where activity_id = ${data.id} and status = 'accepted')
    `;
    if (rows.length < 3) return null;
    const counts = new Map<string, number>();
    for (const row of rows) for (const item of new Set(parseList(row.seeking).map((label) => label.split(" · ").pop() ?? label))) counts.set(item, (counts.get(item) ?? 0) + 1);
    const shared = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => ({ label, count }));
    return { people: rows.length, shared };
  });

// ---------------------------------------------------------------------------
// Album: die Bilder aus dem Gruppenchat, nur für Dabei-Gewesene

export const meetAlbum = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const act = await memberOf(sql, data.id, context.userId);
    if (!act.member) throw new Error("Aktivität nicht gefunden.");
    const rows = await sql<{ id: string; attachment_data: string; attachment_type: string; created_at: unknown }>`
      select id, attachment_data, attachment_type, created_at from messages
      where activity_id = ${data.id} and attachment_type like 'image/%' and attachment_data is not null
      order by created_at limit 40
    `;
    return rows.map((row) => ({ id: row.id, src: row.attachment_data.startsWith("data:") ? row.attachment_data : `data:${row.attachment_type};base64,${row.attachment_data}`, at: iso(row.created_at) }));
  });

// ---------------------------------------------------------------------------
// Danke sagen, privat

export const thanksPeople = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const act = await memberOf(sql, data.id, context.userId);
    if (!act.member) throw new Error("Aktivität nicht gefunden.");
    const rows = await sql<{ user_id: string; display_name: string; avatar_url: string; thanked: boolean }>`
      select p.user_id, p.display_name, p.avatar_url,
        exists (select 1 from thanks t where t.activity_id = ${data.id} and t.from_id = ${context.userId} and t.to_id = p.user_id) as thanked
      from profiles p
      where p.user_id <> ${context.userId}
        and (p.user_id = ${act.host_id} or p.user_id in (select requester_id from join_requests where activity_id = ${data.id} and status = 'accepted'))
    `;
    return rows.map((row) => ({ userId: row.user_id, name: row.display_name, avatar: row.avatar_url, thanked: Boolean(row.thanked) }));
  });

export const sendThanks = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; to: string }) => ({ id: clean(input.id, 80), to: clean(input.to, 80) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    const act = await memberOf(sql, data.id, context.userId);
    const other = await memberOf(sql, data.id, data.to);
    if (!act.member || !other.member || data.to === context.userId) throw new Error("Aktivität nicht gefunden.");
    if (new Date(iso(act.starts_at)).getTime() > Date.now()) throw new Error("Das geht erst, wenn das Treffen angefangen hat.");
    const fresh = await sql<{ to_id: string }>`
      insert into thanks (activity_id, from_id, to_id) values (${data.id}, ${context.userId}, ${data.to}) on conflict do nothing returning to_id
    `;
    if (fresh.length) await notify(sql, data.to, "thanks", `${profile.displayName.split(" ")[0]} sagt danke`, `Für „${act.title}“. Nur du siehst das.`, `/activity/${data.id}`, `thanks:${data.id}:${context.userId}`);
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// "Ich hab jetzt 2 Std Zeit": nur Freunde sehen es, läuft ab, höchstens 3× am Tag

export const myFreeSignal = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ until: unknown }>`select until from free_signals where user_id = ${context.userId} and until > now()`;
    return rows[0] ? { until: iso(rows[0].until) } : null;
  });

export const setFreeSignal = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { on: boolean; hours?: number }) => ({ on: Boolean(input.on), hours: Math.min(3, Math.max(1, Math.round(Number(input.hours)) || 2)) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    if (!data.on) {
      await sql`delete from free_signals where user_id = ${context.userId}`;
      return { until: null };
    }
    await throttle(sql, context.userId, "free-signal", 3, 86_400);
    const until = new Date(Date.now() + data.hours * 3_600_000).toISOString();
    await sql`
      insert into free_signals (user_id, until) values (${context.userId}, ${until})
      on conflict (user_id) do update set until = ${until}, created_at = now()
    `;
    return { until };
  });

export const friendsFree = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string; display_name: string; avatar_url: string; city: string; until: unknown }>`
      select p.user_id, p.display_name, p.avatar_url, p.city, s.until
      from free_signals s join profiles p on p.user_id = s.user_id
      join friendships f on f.status = 'accepted'
        and ((f.requester_id = ${context.userId} and f.addressee_id = s.user_id) or (f.addressee_id = ${context.userId} and f.requester_id = s.user_id))
      where s.until > now()
        and not exists (select 1 from blocks b where (b.blocker_id = ${context.userId} and b.blocked_id = s.user_id) or (b.blocker_id = s.user_id and b.blocked_id = ${context.userId}))
      order by s.until limit 12
    `;
    return rows.map((row) => ({ userId: row.user_id, name: row.display_name, avatar: row.avatar_url, city: row.city, until: iso(row.until) }));
  });

// ---------------------------------------------------------------------------
// Private Freundes-Threads

const pairOf = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export const friendThread = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    if ((await friendState(sql, context.userId, data.id)) !== "friends") throw new Error("Nur zwischen Freunden.");
    const [person] = await sql<{ display_name: string; avatar_url: string }>`select display_name, avatar_url from profiles where user_id = ${data.id}`;
    const rows = await sql<{ id: string; sender_id: string; body: string; created_at: unknown }>`
      select id, sender_id, body, created_at from friend_messages where pair = ${pairOf(context.userId, data.id)} order by created_at desc limit 100
    `;
    return {
      name: person?.display_name ?? "",
      avatar: person?.avatar_url ?? "",
      messages: rows.reverse().map((row) => ({ id: row.id, mine: row.sender_id === context.userId, body: row.body, at: iso(row.created_at) })),
    };
  });

export const sendFriendMessage = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; body: string }) => ({ id: clean(input.id, 80), body: clean(input.body, 1000) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (!data.body) throw new Error("Nachricht ist leer.");
    if ((await friendState(sql, context.userId, data.id)) !== "friends") throw new Error("Nur zwischen Freunden.");
    await throttle(sql, context.userId, "friend-message", 40, 60);
    const pair = pairOf(context.userId, data.id);
    await sql`insert into friend_messages (id, pair, sender_id, body) values (${crypto.randomUUID()}, ${pair}, ${context.userId}, ${data.body})`;
    await notify(sql, data.id, "message", profile.displayName, data.body.slice(0, 120), `/freunde/${context.userId}`, `friend:${pair}`);
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Ideenwand

export type Idea = { id: string; text: string; votes: number; mine: boolean; voted: boolean; activityId: string | null };

export const listIdeas = createServerFn({ method: "GET" })
  .middleware([memberMiddleware])
  .handler(async ({ context }): Promise<{ city: string; ideas: Idea[] }> => {
    const { sql, profile } = await ensureProfile(context.userId);
    const rows = await sql<{ id: string; text: string; user_id: string; activity_id: string | null; votes: number; voted: boolean }>`
      select i.id, i.text, i.user_id, i.activity_id,
        (select count(*)::int from idea_votes v where v.idea_id = i.id) as votes,
        exists (select 1 from idea_votes v where v.idea_id = i.id and v.user_id = ${context.userId}) as voted
      from ideas i
      where lower(i.city) = lower(${profile.city}) and i.created_at > now() - interval '30 days'
        and not exists (select 1 from blocks b where (b.blocker_id = ${context.userId} and b.blocked_id = i.user_id) or (b.blocker_id = i.user_id and b.blocked_id = ${context.userId}))
      order by (i.activity_id is null) desc, votes desc, i.created_at desc limit 40
    `;
    return { city: profile.city, ideas: rows.map((row) => ({ id: row.id, text: row.text, votes: num(row.votes), mine: row.user_id === context.userId, voted: Boolean(row.voted), activityId: row.activity_id })) };
  });

export const addIdea = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { text: string }) => ({ text: clean(input.text, 120) }))
  .handler(async ({ data, context }) => {
    const { sql, profile } = await ensureProfile(context.userId);
    if (data.text.length < 4) throw new Error("Schreib kurz, was du machen willst.");
    if (!profile.city) throw new Error("Stell zuerst deinen Ort ein.");
    await throttle(sql, context.userId, "idea", 5, 86_400);
    const id = crypto.randomUUID();
    await sql`insert into ideas (id, user_id, text, city) values (${id}, ${context.userId}, ${data.text}, ${profile.city})`;
    await sql`insert into idea_votes (idea_id, user_id) values (${id}, ${context.userId}) on conflict do nothing`;
    return { id };
  });

export const voteIdea = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string; on: boolean }) => ({ id: clean(input.id, 80), on: Boolean(input.on) }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    if (data.on) await sql`insert into idea_votes (idea_id, user_id) select ${data.id}, ${context.userId} where exists (select 1 from ideas where id = ${data.id}) on conflict do nothing`;
    else await sql`delete from idea_votes where idea_id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

/** Called after an activity was created from an idea: links it and tells everyone who said "Ich auch". */
export async function ideaBecameMeetup(sql: Sql, ideaId: string, activityId: string, hostId: string, title: string) {
  const done = await sql<{ id: string }>`update ideas set activity_id = ${activityId} where id = ${ideaId} and activity_id is null returning id`;
  if (!done.length) return;
  const voters = await sql<{ user_id: string }>`select user_id from idea_votes where idea_id = ${ideaId} and user_id <> ${hostId}`;
  for (const voter of voters) await notify(sql, voter.user_id, "idea", "Aus eurer Idee wird ein Treffen", title, `/activity/${activityId}`, activityId);
}

// ---------------------------------------------------------------------------
// Seitenfarbe und Ortsseiten

export const PAGE_STYLES = ["", "terrakotta", "gruen", "anthrazit", "sand"] as const;

export const setPageStyle = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { style: string }) => ({ style: (PAGE_STYLES as readonly string[]).includes(input.style) ? input.style : "" }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`update profiles set page_style = ${data.style} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const getVenue = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((input: { id: string }) => ({ id: clean(input.id, 80) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [venue] = await sql<{ id: string; name: string; kind: string; address: string; district: string; website: string; idea: string }>`
      select id, name, kind, address, district, website, idea from venues where id = ${data.id}
    `;
    if (!venue) throw new Error("Nicht gefunden.");
    const meetups = await sql<{ id: string; title: string; starts_at: unknown }>`
      select id, title, starts_at from activities
      where cancelled = false and visibility = 'all' and starts_at > now() - interval '2 hours'
        and lower(place_name) like ${`%${venue.name.toLowerCase().slice(0, 40)}%`}
      order by starts_at limit 10
    `;
    return { venue, meetups: meetups.map((row) => ({ id: row.id, title: row.title, startsAt: iso(row.starts_at) })) };
  });
