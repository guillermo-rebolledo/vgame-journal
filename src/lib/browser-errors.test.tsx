// @vitest-environment jsdom
import * as Sentry from "@sentry/nextjs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import ReviewError from "@/app/year-in-review/error";
import { monitoringOptions } from "./monitoring-options";

const wire: string[] = [];
afterEach(async () => {
  cleanup();
  await Sentry.close(2000);
  wire.length = 0;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function enable() {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      wire.push(options.body);
      return new Response(null, { status: 200 });
    }),
  );
  Sentry.init({
    ...monitoringOptions(
      `https://${"b".repeat(32)}@o123.ingest.us.sentry.io/456`,
      "a".repeat(40),
    ),
    enableOpenTelemetrySetup: false,
  });
}

test("Strict Mode capture does not duplicate render errors or interfere with review retry", async () => {
  enable();
  const reset = vi.fn();
  const error = Object.assign(new Error("private client failure"), {
    digest: "123",
  });
  const view = render(
    <StrictMode>
      <ReviewError error={error} reset={reset} />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry review" }));
  expect(reset).toHaveBeenCalledOnce();
  await Sentry.flush(2000);
  expect(wire).toHaveLength(1);
  expect(wire[0]).not.toMatch(/private|digest|123/);
  view.rerender(
    <StrictMode>
      <ReviewError error={new Error("private client failure")} reset={reset} />
    </StrictMode>,
  );
  await Sentry.flush(2000);
  expect(wire).toHaveLength(2);
});

test("React's production server-forwarded error is suppressed, leaving retry available", async () => {
  enable();
  const error = Object.assign(
    new Error(
      "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.",
    ),
    { digest: "123456" },
  );
  render(<ReviewError error={error} reset={vi.fn()} />);
  await Sentry.flush(2000);
  expect(wire).toEqual([]);
  expect(screen.getByRole("button", { name: "Retry review" })).toBeTruthy();
});
