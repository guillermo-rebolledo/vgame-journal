import { describe, expect, test } from "vitest";
import type { DatePrecision } from "@/lib/game-source";
import {
  compareWishlist,
  countdown,
  localDay,
  releaseLabel,
  resolveRelease,
} from "./release-dates";

test.each([
  ["2017-02-24T00:00:00Z", "day", "Feb 24, 2017"],
  ["2026-09-30T23:00:00Z", "day", "Sep 30, 2026"],
  ["2026-11-01T00:00:00Z", "month", "November 2026"],
  ["2026-09-30T00:00:00Z", "quarter", "Q3 2026"],
  ["2026-10-01T00:00:00Z", "quarter", "Q4 2026"],
  ["2027-12-31T00:00:00Z", "year", "2027"],
  ["2027-12-31T00:00:00Z", "tbd", "TBA"],
  [null, "day", "TBA"],
] as const)("%s with %s precision reads %s", (date, precision, label) => {
  expect(releaseLabel(date && new Date(date), precision)).toBe(label);
});

const rd = (
  region: string,
  date: string | null,
  precision: DatePrecision = "day",
  status: string | null = null,
) => ({ region, date: date ? new Date(date) : null, precision, status });

describe("resolveRelease", () => {
  const dates = [
    rd("japan", "2026-11-05T00:00:00Z"),
    rd("north_america", "2026-11-19T00:00:00Z"),
    rd("europe", "2026-09-30T00:00:00Z", "quarter"),
  ];

  test.each([
    ["earliest", "Nov 5, 2026", true],
    ["japan", "Nov 5, 2026", true],
    ["north_america", "Nov 19, 2026", true],
    ["europe", "Q3 2026", false],
  ] as const)("%s reads %s", (region, label, exact) => {
    const release = resolveRelease(dates, region);
    expect(release.label).toBe(label);
    expect(release.precision === "day").toBe(exact);
  });

  test.each([
    [
      "an exact date beats an earlier imprecise one",
      [
        rd("japan", "2026-12-31T00:00:00Z", "year"),
        rd("europe", "2027-02-01T00:00:00Z"),
      ],
      "earliest",
      "Feb 1, 2027",
    ],
    [
      "the earliest imprecise date when none is exact",
      [
        rd("japan", "2027-12-31T00:00:00Z", "year"),
        rd("europe", "2027-09-30T00:00:00Z", "quarter"),
      ],
      "earliest",
      "Q3 2027",
    ],
    [
      "an earlier year beats a later quarter",
      [
        rd("europe", "2027-03-31T00:00:00Z", "quarter"),
        rd("japan", "2026-12-31T00:00:00Z", "year"),
      ],
      "earliest",
      "2026",
    ],
    [
      "betas, alphas and cancelled dates aren't releases",
      [
        rd("worldwide", "2026-04-22T00:00:00Z", "day", "Beta"),
        rd("worldwide", "2026-03-01T00:00:00Z", "day", "Alpha"),
        rd("worldwide", "2026-02-01T00:00:00Z", "day", "Cancelled"),
        rd("worldwide", "2027-06-30T00:00:00Z", "quarter", "Full Release"),
      ],
      "earliest",
      "Q2 2027",
    ],
    [
      "early access counts as a release",
      [
        rd("worldwide", "2026-04-22T00:00:00Z", "day", "Early Access"),
        rd("worldwide", "2027-06-30T00:00:00Z", "quarter", "Full Release"),
      ],
      "earliest",
      "Apr 22, 2026",
    ],
    [
      "a worldwide date counts for every region",
      [
        rd("worldwide", "2026-12-01T00:00:00Z"),
        rd("europe", "2026-12-10T00:00:00Z"),
      ],
      "europe",
      "Dec 1, 2026",
    ],
    [
      "other regions when the chosen one has no date",
      [rd("japan", "2026-12-01T00:00:00Z")],
      "europe",
      "Dec 1, 2026",
    ],
    [
      "TBA when nothing is dated",
      [rd("worldwide", null, "tbd")],
      "earliest",
      "TBA",
    ],
    ["TBA with no release dates at all", [], "earliest", "TBA"],
    [
      "an exact date with a known month only",
      [rd("worldwide", "2026-11-01T00:00:00Z", "month")],
      "earliest",
      "November 2026",
    ],
  ] as const)("%s", (_, dates, region, label) => {
    expect(resolveRelease(dates, region).label).toBe(label);
  });
});

/** A game's release from a single worldwide date. */
const on = (date: string | null, precision: DatePrecision = "day") =>
  resolveRelease([rd("worldwide", date, precision)], "earliest");

describe("countdown", () => {
  test.each([
    ["2026-11-26", "1 month"],
    ["2026-11-02", "1 week"],
    ["2026-10-27", "1 day"],
    ["2026-11-01", "6 days"],
    ["2026-11-25", "4 weeks, 2 days"],
    ["2027-01-12", "2 months, 2 weeks, 3 days"],
    ["2027-10-26", "12 months"],
    ["2026-10-26", "Today!"],
    ["2026-10-25", "Out now"],
    ["2020-01-01", "Out now"],
  ])("on 2026-10-26, a release on %s reads %s", (release, text) => {
    expect(countdown(on(`${release}T00:00:00Z`), "2026-10-26")).toBe(text);
  });

  test("a month from the 31st ends on the last day of a shorter month", () => {
    expect(countdown(on("2026-02-28T00:00:00Z"), "2026-01-31")).toBe("1 month");
    expect(countdown(on("2026-03-01T00:00:00Z"), "2026-01-31")).toBe(
      "1 month, 1 day",
    );
  });

  test("the release day is its UTC calendar day", () => {
    expect(countdown(on("2026-10-27T23:00:00Z"), "2026-10-26")).toBe("1 day");
  });
});

describe("countdown for imprecise releases", () => {
  test.each([
    ["2026-10-01T00:00:00Z", "month", "2026-10-31", null],
    ["2026-10-01T00:00:00Z", "month", "2026-11-01", "Out now"],
    ["2026-09-01T00:00:00Z", "month", "2026-10-26", "Out now"],
    ["2026-09-30T00:00:00Z", "quarter", "2026-09-30", null],
    ["2026-09-30T00:00:00Z", "quarter", "2026-10-01", "Out now"],
    ["2026-12-31T00:00:00Z", "year", "2026-10-26", null],
    ["2026-12-31T00:00:00Z", "year", "2027-01-01", "Out now"],
    [null, "tbd", "2099-01-01", null],
  ] as const)("%s with %s precision on %s reads %s", (date, precision, today, text) => {
    expect(countdown(on(date, precision), today)).toBe(text);
  });
});

describe("localDay", () => {
  test.each([
    ["2026-10-26T03:00:00Z", "America/Los_Angeles", "2026-10-25"],
    ["2026-10-26T03:00:00Z", "Asia/Tokyo", "2026-10-26"],
    ["2026-10-25T16:00:00Z", "Asia/Tokyo", "2026-10-26"],
    ["2026-10-25T16:00:00Z", "UTC", "2026-10-25"],
  ])("%s in %s is %s", (now, timeZone, day) => {
    expect(localDay(new Date(now), timeZone)).toBe(day);
  });

  test("release day arrives at local midnight, not UTC midnight", () => {
    const release = on("2026-10-26T00:00:00Z");
    const now = new Date("2026-10-26T03:00:00Z");
    expect(countdown(release, localDay(now, "America/Los_Angeles"))).toBe(
      "1 day",
    );
    expect(countdown(release, localDay(now, "Asia/Tokyo"))).toBe("Today!");
  });
});

test("the wishlist runs exact dates ascending, then imprecise ones, then TBA, ties by title", () => {
  const game = (title: string, ...dates: ReturnType<typeof rd>[]) => ({
    title,
    release: resolveRelease(dates, "earliest"),
  });
  const wishlist = [
    game("TBA game"),
    game("Next year", rd("worldwide", "2027-12-31T00:00:00Z", "year")),
    game("Late", rd("worldwide", "2027-06-01T00:00:00Z")),
    game("Soon B", rd("worldwide", "2026-11-05T00:00:00Z")),
    game("This quarter", rd("worldwide", "2026-12-31T00:00:00Z", "quarter")),
    game("Soon A", rd("worldwide", "2026-11-05T00:00:00Z")),
  ];
  expect(wishlist.sort(compareWishlist).map((g) => g.title)).toEqual([
    "Soon A",
    "Soon B",
    "Late",
    "This quarter",
    "Next year",
    "TBA game",
  ]);
});
