import { afterEach, beforeEach, expect, test, vi } from "vitest";

const refreshReleaseDates = vi.fn(async () => 7);
vi.mock("@/lib/catalog", () => ({ catalog: { refreshReleaseDates } }));
const { GET } = await import("./route");

const call = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/refresh-release-dates", {
      headers: authorization ? { authorization } : {},
    }),
  );

beforeEach(() => refreshReleaseDates.mockClear());
afterEach(() => vi.unstubAllEnvs());

test("only Vercel Cron, with the CRON_SECRET, can run the refresh", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");

  expect((await call()).status).toBe(401);
  expect((await call("Bearer wrong")).status).toBe(401);
  expect(refreshReleaseDates).not.toHaveBeenCalled();

  const response = await call("Bearer s3cret");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ refreshed: 7 });
});

test("without a CRON_SECRET configured, nobody can run it", async () => {
  vi.stubEnv("CRON_SECRET", "");

  expect((await call("Bearer ")).status).toBe(401);
  expect((await call("Bearer undefined")).status).toBe(401);
  expect(refreshReleaseDates).not.toHaveBeenCalled();
});
