import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/** Serves an activity photo as a real, cacheable image instead of base64 inside every feed response. */
export const Route = createFileRoute("/media/activity/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const sql = await getSql();
        const rows = await sql<{ image_url: string }>`select image_url from activities where id = ${params.id}`;
        const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/s.exec(rows[0]?.image_url ?? "");
        if (!match) return new Response("Not found", { status: 404 });
        return new Response(Buffer.from(match[2], "base64"), {
          headers: { "Content-Type": match[1], "Cache-Control": "public, max-age=31536000, immutable" },
        });
      },
    },
  },
});
