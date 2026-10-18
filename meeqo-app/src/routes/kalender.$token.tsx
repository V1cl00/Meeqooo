import { createFileRoute } from "@tanstack/react-router";
import { calendarFeed, originOf } from "@/lib/meeqo/cal-feed";

/** Old feed address, kept so existing subscriptions keep working. New links use /cal/<token>.ics. */
export const Route = createFileRoute("/kalender/$token")({
  server: { handlers: { GET: async ({ params, request }) => calendarFeed(params.token, originOf(request)) } },
});
