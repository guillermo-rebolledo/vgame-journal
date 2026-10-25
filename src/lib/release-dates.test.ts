import { expect, test } from "vitest";
import { releaseLabel } from "./release-dates";

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
