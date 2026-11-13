// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { track } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { afterEach, expect, test, vi } from "vitest";
import {
  Analytics,
  countBucket,
  googleCallbackURL,
  positionBucket,
  redactAnalyticsEvent,
  resultsBucket,
  trackEvent,
} from "./analytics";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: vi.fn(() => null),
}));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
  vi.mocked(SpeedInsights).mockClear();
});

test("Speed Insights uses URL redaction without dropping other event fields", () => {
  render(<Analytics />);
  const { beforeSend } = vi.mocked(SpeedInsights).mock.calls[0][0];
  expect(
    beforeSend?.({
      type: "vital",
      url: "https://example.com/u/jane-doe?token=secret#private",
      route: "/u/[username]",
    }),
  ).toEqual({
    type: "vital",
    url: "https://example.com/u/[username]",
    route: "/u/[username]",
  });
});

const urlOf = (url: string) =>
  redactAnalyticsEvent({ type: "pageview", url }).url;

test("telemetry hides Calendar and auth path credentials, including route fields", () => {
  expect(
    redactAnalyticsEvent({
      url: "https://example.com/api/calendar/synthetic-secret?token=secret#private",
      route: "/api/calendar/synthetic-secret",
      type: "vital",
    }),
  ).toEqual({
    url: "https://example.com/api/calendar/[token]",
    route: "/api/calendar/[token]",
    type: "vital",
  });
  expect(
    urlOf(
      "https://example.com/api/auth/reset-password/synthetic-secret?callbackURL=/library",
    ),
  ).toBe("https://example.com/api/auth/[redacted]");
});

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

test("redactAnalyticsEvent keeps bounded filters but drops campaign and platform text", () => {
  expect(
    urlOf(
      "https://example.com/library?status=playing&platform=6&year=2024&rated=1&sort=rating&libraryPage=2&utm_source=reddit",
    ),
  ).toBe(
    "https://example.com/library?status=playing&year=2024&rated=1&sort=rating&libraryPage=2",
  );
});

test("allowed query keys cannot carry private text, duplicate values or arbitrary page keys", () => {
  expect(
    urlOf(
      "https://example.com/library?status=secret&sort=private&year=secret&rated=secret&view=secret&all=secret&libraryPage=secret&utm_secret=secret&privatePage=2&status=playing",
    ),
  ).toBe("https://example.com/library");
});

test("telemetry removes URL credentials and fails closed for malformed URLs", () => {
  expect(urlOf("https://private:secret@example.com/library")).toBe(
    "https://example.com/library",
  );
  expect(urlOf("not a URL containing a secret")).toBe(
    "https://redacted.invalid/[redacted]",
  );
});

test("encoded route prefixes cannot bypass credential redaction", () => {
  expect(urlOf("https://example.com/%61pi/%63alendar/synthetic-secret")).toBe(
    "https://example.com/api/calendar/[token]",
  );
  expect(
    urlOf("https://example.com/%75/private-person/lists/private-list"),
  ).toBe("https://example.com/u/[username]/lists/[listId]");
});

test("encoded control characters cannot interrupt credential path redaction", () => {
  expect(urlOf("https://example.com/api/calendar/synthetic%0Asecret")).toBe(
    "https://example.com/api/calendar/[token]",
  );
  expect(
    urlOf("https://example.com/api/auth/reset-password/synthetic%0Asecret"),
  ).toBe("https://example.com/api/auth/[redacted]");
});

test("redactAnalyticsEvent hides usernames on public profiles", () => {
  expect(urlOf("https://example.com/u/jane-doe?view=finished")).toBe(
    "https://example.com/u/[username]?view=finished",
  );
  expect(
    urlOf("https://example.com/u/jane-doe/lists/private-id?view=lists"),
  ).toBe("https://example.com/u/[username]/lists/[listId]?view=lists");
  expect(urlOf("https://example.com/lists/private-id?gamesPage=2")).toBe(
    "https://example.com/lists/[listId]?gamesPage=2",
  );
});

test("redactAnalyticsEvent leaves public game pages untouched", () => {
  expect(urlOf("https://example.com/games/hades-ii")).toBe(
    "https://example.com/games/hades-ii",
  );
});

test.each([
  [0, "0"],
  [1, "1-9"],
  [9, "1-9"],
  [10, "10+"],
  [250, "10+"],
])("resultsBucket(%i) is %s", (count, bucket) => {
  expect(resultsBucket(count)).toBe(bucket);
});

test.each([
  [0, "0"],
  [9, "1-9"],
  [10, "10-49"],
  [49, "10-49"],
  [50, "50-199"],
  [199, "50-199"],
  [200, "200+"],
])("countBucket(%i) is %s", (count, bucket) => {
  expect(countBucket(count)).toBe(bucket);
});

test.each([
  [1, "1-3"],
  [3, "1-3"],
  [4, "4-10"],
  [10, "4-10"],
  [11, "11+"],
])("positionBucket(%i) is %s", (position, bucket) => {
  expect(positionBucket(position)).toBe(bucket);
});

test("redactAnalyticsEvent redacts custom event URLs too", () => {
  expect(
    redactAnalyticsEvent({
      type: "event",
      url: "https://example.com/?q=jane%40example.com",
    }).url,
  ).toBe("https://example.com/");
});

test("trackEvent never throws, even if Vercel Analytics does", () => {
  vi.mocked(track).mockImplementationOnce(() => {
    throw new Error("blocked");
  });
  expect(() => trackEvent("account_deleted")).not.toThrow();
});

test("the event catalogue rejects unknown names, extra and free-text properties", () => {
  const freeText: string = "jane@example.com";
  // @ts-expect-error unknown event name
  trackEvent("search_text_entered");
  // @ts-expect-error extra property beyond the catalogue
  trackEvent("link_copied", { target: "calendar", url: "x" });
  // @ts-expect-error free-text property value
  trackEvent("link_copied", { target: freeText });
  // @ts-expect-error missing required properties
  trackEvent("game_searched");
});

test("a Google return records sign-in or sign-up once, then drops the marker", () => {
  window.history.replaceState(
    null,
    "",
    googleCallbackURL("/library?status=playing", true),
  );
  render(<Analytics />);
  expect(track).toHaveBeenCalledExactlyOnceWith("sign_up_completed", {
    method: "google",
  });
  expect(`${window.location.pathname}${window.location.search}`).toBe(
    "/library?status=playing",
  );
  cleanup();

  window.history.replaceState(null, "", googleCallbackURL("/", false));
  render(<Analytics />);
  expect(track).toHaveBeenLastCalledWith("sign_in_completed", {
    method: "google",
  });
  cleanup();

  render(<Analytics />);
  expect(track).toHaveBeenCalledTimes(2);
});

test("a new Google user counts as signed up on reaching onboarding, not after it", () => {
  const returnTo = googleCallbackURL("/library", true);
  window.history.replaceState(
    null,
    "",
    `/onboarding?${new URLSearchParams({ returnTo })}`,
  );
  render(<Analytics />);
  expect(track).toHaveBeenCalledExactlyOnceWith("sign_up_completed", {
    method: "google",
  });
  expect(new URL(window.location.href).searchParams.get("returnTo")).toBe(
    "/library",
  );
});
