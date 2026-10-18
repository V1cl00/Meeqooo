import { createFileRoute } from "@tanstack/react-router";
import { calendarFeed, originOf } from "@/lib/meeqo/cal-feed";

/** Private calendar feed: /cal/<token>.ics. The token is the only key and can be replaced or ended in Settings. */
export const Route = createFileRoute("/cal/$file")({
  server: { handlers: { GET: async ({ params, request }) => calendarFeed(params.file.replace(/\.ics$/i, ""), originOf(request)) } },
});
