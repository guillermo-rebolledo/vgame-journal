import { describe, expect, it } from "vitest";
import { redactAnalyticsEvent } from "./analytics";

describe("redactAnalyticsEvent", () => {
  it("drops the password reset token from page view URLs", () => {
    expect(
      redactAnalyticsEvent({
        type: "pageview",
        url: "https://example.com/reset-password?token=secret123&error=INVALID_TOKEN",
      }),
    ).toEqual({
      type: "pageview",
      url: "https://example.com/reset-password?error=INVALID_TOKEN",
    });
  });

  it("leaves URLs without a token untouched", () => {
    const event = {
      type: "event" as const,
      url: "https://example.com/games?q=zelda",
    };
    expect(redactAnalyticsEvent(event)).toEqual(event);
  });
});
