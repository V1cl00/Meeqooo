import { createFileRoute } from "@tanstack/react-router";
import { renderCard } from "@/lib/meeqo/share-card.server";

/** Share image for link previews (1200x630) and, with ?format=story, a 1080x1920 story image. */
export const Route = createFileRoute("/og/activity/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const story = url.searchParams.get("format") === "story";
        try {
          const png = await renderCard(params.id, story);
          const headers: Record<string, string> = { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=600" };
          if (url.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename="meeqo-${story ? "story" : "treffen"}.jpg"`;
          return new Response(new Uint8Array(png), { headers });
        } catch (err) {
          console.error("og image failed", err);
          return Response.redirect(new URL("/favicon.svg", url), 302);
        }
      },
    },
  },
});
