import { readdirSync } from "node:fs";
import { expect, test } from "vitest";
import {
  BOARDS,
  boardName,
  boardRegion,
  pickRatings,
  ratingLogo,
  ratingMeaning,
  sortLanguages,
} from "./age-ratings";

const rating = (board: string, code: string) => ({
  board,
  rating: code,
  descriptors: [],
});
const all = [
  rating("CLASS_IND", "14"),
  rating("ACB", "M"),
  rating("CERO", "C"),
  rating("PEGI", "16"),
  rating("ESRB", "T"),
  rating("USK", "16"),
  rating("GRAC", "15+"),
];
const boards = (ratings: { board: string }[]) => ratings.map((r) => r.board);

test.each([
  [null, "ESRB"],
  ["earliest", "ESRB"],
  ["north_america", "ESRB"],
  ["europe", "PEGI"],
  ["japan", "CERO"],
] as const)("region %s headlines %s", (region, board) => {
  expect(pickRatings(all, region).headline?.board).toBe(board);
});

test("the other boards follow the fixed order", () => {
  expect(boards(pickRatings(all, "europe").others)).toEqual([
    "ESRB",
    "CERO",
    "USK",
    "ACB",
    "GRAC",
    "CLASS_IND",
  ]);
});

test("a missing board falls back to the first rated board in order", () => {
  const ratings = [
    rating("ACB", "M"),
    rating("USK", "12"),
    rating("CERO", "B"),
  ];
  const { headline, others } = pickRatings(ratings, "europe");
  expect(headline).toEqual(rating("CERO", "B"));
  expect(boards(others)).toEqual(["USK", "ACB"]);
});

test("a game rated by one non-ESRB board headlines it for guests", () => {
  expect(pickRatings([rating("GRAC", "12+")], null)).toEqual({
    headline: rating("GRAC", "12+"),
    others: [],
  });
});

test("an unrated game has no headline", () => {
  expect(pickRatings([], "japan")).toEqual({ headline: null, others: [] });
});

test.each([
  ["ESRB", "RP", "Rating Pending"],
  ["ESRB", "EC", "Early Childhood"],
  ["ESRB", "E", "Everyone"],
  ["ESRB", "E10+", "Everyone 10+"],
  ["ESRB", "T", "Teen"],
  ["ESRB", "M", "Mature 17+"],
  ["ESRB", "AO", "Adults Only 18+"],
  ["CERO", "A", "All ages"],
  ["CERO", "B", "Ages 12+"],
  ["CERO", "C", "Ages 15+"],
  ["CERO", "D", "Ages 17+"],
  ["CERO", "Z", "Ages 18+"],
  ["PEGI", "3", "Ages 3+"],
  ["USK", "0", "Ages 0+"],
  ["CLASS_IND", "14", "Ages 14+"],
  ["GRAC", "15+", "Ages 15+"],
  ["ACB", "MA 15+", "Ages 15+"],
  ["ACB", "R 18+", "Ages 18+"],
  ["ACB", "M", "M"],
  ["ACB", "PG", "PG"],
  ["GRAC", "ALL", "ALL"],
  ["CLASS_IND", "L", "L"],
])("%s %s means %s", (board, code, meaning) => {
  expect(ratingMeaning(rating(board, code))).toBe(meaning);
});

test.each([
  ["ESRB", "ESRB", "North America"],
  ["PEGI", "PEGI", "Europe"],
  ["CERO", "CERO", "Japan"],
  ["USK", "USK", "Germany"],
  ["ACB", "ACB", "Australia"],
  ["GRAC", "GRAC", "South Korea"],
  ["CLASS_IND", "ClassInd", "Brazil"],
])("%s is shown as %s from %s", (board, name, region) => {
  expect(boardName(board)).toBe(name);
  expect(boardRegion(board)).toBe(region);
});

test.each([
  ["ESRB", "E10+", "/ratings/esrb-e10plus.svg"],
  ["ACB", "MA 15+", "/ratings/acb-ma-15plus.svg"],
  ["CLASS_IND", "L", "/ratings/class-ind-l.svg"],
  ["GRAC", "TESTING", null],
  ["PEGI", "Unknown", null],
])("%s %s logo is %s", (board, code, path) => {
  expect(ratingLogo(rating(board, code))).toBe(path);
});

test("every logo path points at a file in public/ratings", () => {
  const files = readdirSync("public/ratings");
  const paths = files.map((f) => `/ratings/${f}`);
  expect(files).toHaveLength(39);
  for (const [board, { codes }] of Object.entries(BOARDS))
    for (const code of codes)
      expect(paths).toContain(ratingLogo(rating(board, code)));
});

test("voiced languages come first, then alphabetical", () => {
  const lang = (name: string, voices: boolean) => ({
    name,
    voices,
    subtitles: true,
    interface: true,
  });
  expect(
    sortLanguages([
      lang("German", false),
      lang("Japanese", true),
      lang("Arabic", false),
      lang("English", true),
    ]).map((l) => l.name),
  ).toEqual(["English", "Japanese", "Arabic", "German"]);
});
