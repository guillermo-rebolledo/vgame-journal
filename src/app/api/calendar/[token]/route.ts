import { journal } from "@/lib/journal";

/** The user's Wishlist as an iCalendar feed. The secret token in the URL is the only auth: calendar apps send no cookies. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/calendar/[token]">,
) {
  const { token } = await params;
  const feed = await journal.calendarFeed(token.replace(/\.ics$/, ""));
  if (feed === null) return new Response("Not found", { status: 404 });
  return new Response(feed, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
