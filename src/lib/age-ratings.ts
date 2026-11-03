import type { Region } from "@/lib/release-dates";

/** Same shape as GameSource's SourceAgeRating; board is IGDB's organization name. */
type AgeRating = { board: string; rating: string; descriptors: string[] };
type Language = {
  name: string;
  voices: boolean;
  subtitles: boolean;
  interface: boolean;
};

/** Each board's display name, region and IGDB rating codes (except GRAC "TESTING"). In fallback order. */
const BOARDS: Record<
  string,
  { name: string; region: string; codes: string[] }
> = {
  ESRB: {
    name: "ESRB",
    region: "North America",
    codes: ["RP", "EC", "E", "E10+", "T", "M", "AO"],
  },
  PEGI: { name: "PEGI", region: "Europe", codes: ["3", "7", "12", "16", "18"] },
  CERO: { name: "CERO", region: "Japan", codes: ["A", "B", "C", "D", "Z"] },
  USK: { name: "USK", region: "Germany", codes: ["0", "6", "12", "16", "18"] },
  ACB: {
    name: "ACB",
    region: "Australia",
    codes: ["G", "PG", "M", "MA 15+", "R 18+", "RC"],
  },
  GRAC: {
    name: "GRAC",
    region: "South Korea",
    codes: ["ALL", "12+", "15+", "18+", "19+"],
  },
  CLASS_IND: {
    name: "ClassInd",
    region: "Brazil",
    codes: ["L", "10", "12", "14", "16", "18"],
  },
};
const ORDER = Object.keys(BOARDS);

/** Every board's rating codes that have a logo. */
export const RATING_CODES = Object.fromEntries(
  ORDER.map((b) => [b, BOARDS[b].codes]),
);

const REGION_BOARD: Record<Region, string> = {
  earliest: "ESRB",
  north_america: "ESRB",
  europe: "PEGI",
  japan: "CERO",
};

/** The rating to headline for a Region (guests: null, get ESRB), falling back in board order; the rest in board order. */
export function pickRatings<T extends AgeRating>(
  ratings: readonly T[],
  region: Region | null,
) {
  const sorted = ORDER.flatMap((b) => ratings.filter((r) => r.board === b));
  const board = REGION_BOARD[region ?? "north_america"];
  const headline = sorted.find((r) => r.board === board) ?? sorted[0] ?? null;
  return { headline, others: sorted.filter((r) => r !== headline) };
}

const MEANINGS: Record<string, Record<string, string>> = {
  ESRB: {
    RP: "Rating Pending",
    EC: "Early Childhood",
    E: "Everyone",
    "E10+": "Everyone 10+",
    T: "Teen",
    M: "Mature 17+",
    AO: "Adults Only 18+",
  },
  CERO: {
    A: "All ages",
    B: "Ages 12+",
    C: "Ages 15+",
    D: "Ages 17+",
    Z: "Ages 18+",
  },
};

/** "Teen", "Ages 12+"; a code without an age ("PG", "ALL", "L") reads as itself. */
export function ratingMeaning(board: string, code: string) {
  const age = code.match(/\d+/)?.[0];
  return MEANINGS[board]?.[code] ?? (age ? `Ages ${age}+` : code);
}

/** "ClassInd" for IGDB's "CLASS_IND"; other boards keep their acronym. */
export const boardName = (board: string) => BOARDS[board]?.name ?? board;

/** Where a board rates games: "North America", "Brazil". */
export const boardRegion = (board: string) => BOARDS[board]?.region ?? "";

/**
 * The self-hosted logo for a rating, or null if there's none (show the code instead).
 * Logos are from Wikimedia Commons (public domain there; the boards' trademarks), optimised with svgo.
 */
export function ratingLogo(board: string, code: string) {
  if (!BOARDS[board]?.codes.includes(code)) return null;
  const slug = `${board}-${code}`
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[\s_]+/g, "-");
  return `/ratings/${slug}.svg`;
}

/** Voiced languages first, then alphabetical. */
export const sortLanguages = <T extends Language>(languages: readonly T[]) =>
  languages.toSorted(
    (a, b) =>
      Number(b.voices) - Number(a.voices) || a.name.localeCompare(b.name),
  );
