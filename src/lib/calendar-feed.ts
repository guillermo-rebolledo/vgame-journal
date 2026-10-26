import { SITE_NAME } from "@/config/site";
import type { WishlistEntry } from "@/lib/journal";

// RFC 5545: lines end in CRLF and fold at 75 octets; text escapes \ ; , and newlines.
const escapeText = (text: string) =>
  text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

function fold(line: string) {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let part = "";
  for (const char of line) {
    // Continuation lines start with a space, which counts toward their 75.
    if (bytes.encode(part + char).length > (parts.length ? 74 : 75)) {
      parts.push(part);
      part = "";
    }
    part += char;
  }
  return [...parts, part].join("\r\n ");
}

/** "20261105" from a UTC calendar date. */
const icsDay = (date: Date) =>
  date.toISOString().slice(0, 10).replace(/-/g, "");

/** An iCalendar feed with an all-day event for each wishlisted game that has an exact release date. */
export function calendarFeed(
  entries: readonly WishlistEntry[],
  now = new Date(),
) {
  const stamp = now.toISOString().replace(/[-:]|\.\d+/g, "");
  const events = entries.flatMap(({ gameId, title, release }) => {
    if (release.precision !== "day" || !release.date) return [];
    const nextDay = new Date(release.date.getTime() + 86_400_000);
    return [
      "BEGIN:VEVENT",
      `UID:game-${gameId}@vgame-journal`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDay(release.date)}`,
      `DTEND;VALUE=DATE:${icsDay(nextDay)}`,
      `SUMMARY:${escapeText(`${title} releases`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeText(SITE_NAME)}//Wishlist//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`${SITE_NAME} wishlist`)}`,
    ...events,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}
