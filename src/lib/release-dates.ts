import type { DatePrecision } from "@/lib/game-source";

// GameSource dates are UTC calendar dates, so they're shown in UTC to avoid slipping a day.
const day = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const month = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** A release date as precise as it is known: "Feb 24, 2017", "November 2026", "Q3 2026", "2027" or "TBA". */
export function releaseLabel(date: Date | null, precision: DatePrecision) {
  if (!date || precision === "tbd") return "TBA";
  const year = date.getUTCFullYear();
  if (precision === "year") return String(year);
  if (precision === "quarter")
    return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${year}`;
  return (precision === "month" ? month : day).format(date);
}

/** "north_america" → "North America". */
export const regionName = (region: string) =>
  region.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
