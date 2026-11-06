import { expect, test } from "vitest";
import {
  type LibraryEntry,
  libraryParams,
  parseLibraryParams,
  queryLibrary,
} from "./library";

const entry = (
  gameId: number,
  title: string,
  rating: number | null,
): LibraryEntry => ({
  gameId,
  title,
  slug: `game-${gameId}`,
  coverImageId: null,
  status: "played",
  completionTag: null,
  rating,
  ratedAt: rating === null ? null : new Date("2026-01-01"),
  addedAt: new Date("2026-01-01"),
  releasedAt: null,
  platforms: [],
  years: [],
});

const entries = [
  entry(1, "Celeste", 6),
  entry(2, "Hades", null),
  entry(3, "Outer Wilds", 10),
  entry(4, "Braid", 6),
  entry(5, "Abzû", null),
];

test("the Rating sort puts the highest first, unrated last, ties by title", () => {
  expect(queryLibrary(entries, {}, "rating").map((e) => e.title)).toEqual([
    "Outer Wilds",
    "Braid",
    "Celeste",
    "Abzû",
    "Hades",
  ]);
});

test("the Rated filter keeps only rated games, combined with other filters", () => {
  expect(queryLibrary(entries, { rated: true }).map((e) => e.gameId)).toEqual(
    expect.arrayContaining([1, 3, 4]),
  );
  expect(queryLibrary(entries, { rated: true })).toHaveLength(3);
  expect(
    queryLibrary(entries, { rated: true, query: "br" }).map((e) => e.title),
  ).toEqual(["Braid"]);
});

test("the Rating sort and Rated filter round-trip through the URL; unknown values fall back to defaults", () => {
  const parsed = parseLibraryParams(new URLSearchParams("sort=rating&rated=1"));
  expect(parsed).toEqual({
    filters: expect.objectContaining({ rated: true }),
    sort: "rating",
  });
  expect(libraryParams(parsed.filters, parsed.sort)).toBe(
    "rated=1&sort=rating",
  );

  for (const query of ["sort=stars&rated=yes", "rated=0", "rated=", ""])
    expect(parseLibraryParams(new URLSearchParams(query))).toEqual({
      filters: expect.objectContaining({ rated: undefined }),
      sort: "added",
    });
  expect(libraryParams({}, "added")).toBe("");
});
