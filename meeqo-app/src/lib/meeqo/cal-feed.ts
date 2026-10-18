import { getSql } from "@/lib/db";
import { icsCalendar } from "@/lib/meeqo/ics";

/** The subscribed calendar for one token. Only title, time, place and link; open requests show the city only. */
export async function calendarFeed(token: string, origin: string) {
  const sql = await getSql();
  const owner = await sql<{ user_id: string }>`select user_id from calendar_tokens where token = ${token}`;
  if (!owner[0]) return new Response("Not found", { status: 404 });
  const me = owner[0].user_id;
  const rows = await sql<{ id: string; title: string; starts_at: unknown; duration_min: number; place_name: string; city: string; cancelled: boolean; host_id: string; my_status: string | null }>`
    select a.id, a.title, a.starts_at, a.duration_min, a.place_name, a.city, a.cancelled, a.host_id,
      (select j.status from join_requests j where j.activity_id = a.id and j.requester_id = ${me} order by j.created_at desc limit 1) as my_status
    from activities a
    where a.starts_at > now() - interval '7 days'
      and (a.host_id = ${me}
        or exists (select 1 from join_requests j where j.activity_id = a.id and j.requester_id = ${me} and j.status in ('accepted', 'pending')))
    order by a.starts_at asc
    limit 300
  `;
  const body = icsCalendar(
    rows.map((row) => {
      const mine = row.host_id === me || row.my_status === "accepted";
      return {
        id: row.id,
        title: row.title,
        description: "",
        startsAt: new Date(row.starts_at as string).toISOString(),
        durationMin: Number(row.duration_min) || 120,
        placeName: mine ? row.place_name : "",
        city: row.city,
        url: `${origin}/activity/${row.id}`,
        status: row.cancelled ? ("cancelled" as const) : mine ? ("confirmed" as const) : ("tentative" as const),
      };
    }),
    "MeeQo",
  );
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}

export function originOf(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
