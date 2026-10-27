import type { DatePrecision } from "@/lib/game-source";
import { byTitle } from "@/lib/library";

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

/** Where the user lives, for picking their release date. "earliest" takes the first release anywhere. */
export const REGIONS = [
  "earliest",
  "north_america",
  "europe",
  "japan",
] as const;
export type Region = (typeof REGIONS)[number];

type RawReleaseDate = {
  region: string;
  date: Date | null;
  precision: DatePrecision;
  status?: string | null;
};

/** GameSource statuses for test builds and dropped dates; nobody can buy the game then. Early Access counts as out. */
const NOT_A_RELEASE = new Set(["Alpha", "Beta", "Cancelled", "Offline"]);

/** The one release date shown for a game. Only "day" precision is exact enough for a Countdown. */
export type ResolvedRelease = {
  date: Date | null;
  precision: DatePrecision;
  label: string;
};

/** Exact dates first, each group earliest first; undated last. */
type Dated = Pick<RawReleaseDate, "date" | "precision">;
const byRelease = (a: Dated, b: Dated) =>
  Number(b.precision === "day") - Number(a.precision === "day") ||
  (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity);

/** Wishlist order: exact release dates ascending, then imprecise ones, then TBA. Ties go by title. */
export const compareWishlist = (
  a: { title: string; release: ResolvedRelease },
  b: { title: string; release: ResolvedRelease },
) => byRelease(a.release, b.release) || byTitle(a, b);

/** The game's release in the user's region (worldwide dates count everywhere; any region if theirs has none). An exact date beats vaguer ones; otherwise the earliest. */
export function resolveRelease(
  dates: readonly RawReleaseDate[],
  region: Region,
): ResolvedRelease {
  const dated = dates.filter(
    (d) =>
      d.date && d.precision !== "tbd" && !NOT_A_RELEASE.has(d.status ?? ""),
  );
  const local = dated.filter(
    (d) => d.region === region || d.region === "worldwide",
  );
  const candidates = region === "earliest" || !local.length ? dated : local;
  const [best] = candidates.toSorted(byRelease);
  if (!best) return { date: null, precision: "tbd", label: "TBA" };
  return {
    date: best.date,
    precision: best.precision,
    label: releaseLabel(best.date, best.precision),
  };
}

// en-CA formats as YYYY-MM-DD.
const isoDay = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" });

/** The calendar day ("YYYY-MM-DD") it is right now where the user is. */
export const localDay = (now: Date, timeZone: string) =>
  isoDay(timeZone).format(now);

const DAY_MS = 86_400_000;
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

export const TODAY = "Today!";
export const OUT_NOW = "Out now";

/** The last day of the month, quarter or year an imprecise date stands for, as a UTC timestamp. */
function periodEnd(date: Date, precision: DatePrecision) {
  const month = date.getUTCMonth();
  const lastMonth =
    precision === "month"
      ? month
      : precision === "quarter"
        ? month - (month % 3) + 2
        : 11;
  return Date.UTC(date.getUTCFullYear(), lastMonth + 1, 0);
}

/**
 * Time left until a release, from the user's local day: "2 months, 1 week, 3 days", then "Today!", then "Out now".
 * An imprecise release has no Countdown (null) until its whole month, quarter or year has passed; then it's "Out now".
 */
export function countdown(release: ResolvedRelease, today: string) {
  if (!release.date) return null;
  const [y, m, d] = today.split("-").map(Number);
  const from = Date.UTC(y, m - 1, d);
  if (release.precision !== "day")
    return periodEnd(release.date, release.precision) < from ? OUT_NOW : null;
  const to = Date.UTC(
    release.date.getUTCFullYear(),
    release.date.getUTCMonth(),
    release.date.getUTCDate(),
  );
  if (to === from) return TODAY;
  if (to < from) return OUT_NOW;

  // Whole months first; a month from the 31st lands on the last day of a shorter month.
  const monthsLater = (n: number) =>
    Date.UTC(
      y,
      m - 1 + n,
      Math.min(d, new Date(Date.UTC(y, m + n, 0)).getUTCDate()),
    );
  let months =
    (release.date.getUTCFullYear() - y) * 12 +
    release.date.getUTCMonth() -
    (m - 1);
  if (monthsLater(months) > to) months--;
  const days = Math.round((to - monthsLater(months)) / DAY_MS);

  return [
    [months, "month"],
    [Math.floor(days / 7), "week"],
    [days % 7, "day"],
  ]
    .filter(([n]) => n)
    .map(([n, unit]) => plural(n as number, unit as string))
    .join(", ");
}
