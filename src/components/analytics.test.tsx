import { expect, test } from "vitest";
import { redactAnalyticsEvent } from "./analytics";

const urlOf = (url: string) =>
  redactAnalyticsEvent({ type: "pageview", url }).url;

test("redactAnalyticsEvent drops the password reset token", () => {
  expect(
    urlOf("https://example.com/reset-password?token=secret123&returnTo=%2F"),
  ).toBe("https://example.com/reset-password");
});

test("redactAnalyticsEvent drops free-text search and unknown params", () => {
  expect(
    urlOf(
      "https://example.com/library?q=jane%40example.com&returnTo=%2Fx%3Fq%3Dsecret&email=a%40b.c#access_token=abc",
    ),
  ).toBe("https://example.com/library");
});

test("redactAnalyticsEvent keeps filter, paging and campaign params", () => {
  expect(
    urlOf(
      "https://example.com/library?status=playing&platform=6&year=2024&sort=title&libraryPage=2&utm_source=reddit",
    ),
  ).toBe(
    "https://example.com/library?status=playing&platform=6&year=2024&sort=title&libraryPage=2&utm_source=reddit",
  );
});

test("redactAnalyticsEvent hides usernames on public profiles", () => {
  expect(urlOf("https://example.com/u/jane-doe?view=finished")).toBe(
    "https://example.com/u/[username]?view=finished",
  );
});

test("redactAnalyticsEvent leaves public game pages untouched", () => {
  expect(urlOf("https://example.com/games/hades-ii")).toBe(
    "https://example.com/games/hades-ii",
  );
});
