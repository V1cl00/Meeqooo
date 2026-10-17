import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { icsCalendar } from "@/lib/meeqo/ics";

/** A calendar feed for Apple, Google and Outlook. The token in the address is the only key, so it can be replaced in Settings. */
export const Route = createFileRoute("/kalender/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const sql = await getSql();
        const owner = await sql<{ user_id: string }>`select user_id from calendar_tokens where token = ${params.token}`;
        if (!owner[0]) return new Response("Not found", { status: 404 });
        const rows = await sql<{ id: string; title: string; description: string; starts_at: unknown; duration_min: number; place_name: string; city: string }>`
          select a.id, a.title, a.description, a.starts_at, a.duration_min, a.place_name, a.city
          from activities a
          where a.cancelled = false and a.starts_at > now() - interval '1 day'
            and (a.host_id = ${owner[0].user_id}
              or exists (select 1 from join_requests j where j.activity_id = a.id and j.requester_id = ${owner[0].user_id} and j.status = 'accepted'))
          order by a.starts_at asc
          limit 200
        `;
        const body = icsCalendar(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            startsAt: new Date(row.starts_at as string).toISOString(),
            durationMin: Number(row.duration_min) || 120,
            placeName: row.place_name,
            city: row.city,
          })),
          "MeeQo",
        );
        return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
      },
    },
  },
});
