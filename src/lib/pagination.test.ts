import { expect, test } from "vitest";
import { parsePage } from "./pagination";

test("URL positions are positive whole decimal pages with a safe default", () => {
  for (const value of [
    null,
    "",
    "abc",
    "2.5",
    "0",
    "-1",
    "Infinity",
    "1e2",
    "0x10",
    " 2 ",
  ]) {
    expect(parsePage(value), String(value)).toBe(1);
  }
  expect(parsePage("1")).toBe(1);
  expect(parsePage("2")).toBe(2);
  expect(parsePage("21")).toBe(21);
  expect(parsePage("002")).toBe(2);
});

test("positive positions beyond numeric precision remain clampable last-page requests", () => {
  expect(parsePage("9007199254740992")).toBe(Number.MAX_SAFE_INTEGER);
  expect(parsePage("9".repeat(400))).toBe(Number.MAX_SAFE_INTEGER);
});
