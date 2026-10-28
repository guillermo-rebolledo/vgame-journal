import { afterEach, beforeEach, expect, test, vi } from "vitest";

const refreshReleaseDates = vi.fn(async () => 7);
const refreshDiscovery = vi.fn(async () => ({ recent: 4, popular: 4 }));
const claimScheduledRefresh = vi.fn(async () => true);
vi.mock("@/lib/catalog", () => ({
  catalog: { refreshReleaseDates, refreshDiscovery, claimScheduledRefresh },
}));
const { GET } = await import("./route");

const call = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/refresh-release-dates", {
      headers: authorization ? { authorization } : {},
    }),
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

test("only Vercel Cron, with the CRON_SECRET, can run the refresh", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");

  expect((await call()).status).toBe(401);
  expect((await call("Bearer wrong")).status).toBe(401);
  expect(refreshReleaseDates).not.toHaveBeenCalled();

  const response = await call("Bearer s3cret");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    checked: 7,
    discovery: { recent: 4, popular: 4 },
  });
});

test("without a CRON_SECRET configured, nobody can run it", async () => {
  vi.stubEnv("CRON_SECRET", "");

  expect((await call("Bearer ")).status).toBe(401);
  expect((await call("Bearer undefined")).status).toBe(401);
  expect(refreshReleaseDates).not.toHaveBeenCalled();
});

test("Wishlist failures do not prevent discovery refresh", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  refreshReleaseDates.mockRejectedValueOnce(new Error("Provider down"));
  const response = await call("Bearer s3cret");
  expect(await response.json()).toMatchObject({
    checked: "failed",
    discovery: { recent: 4, popular: 4 },
  });
});

test("discovery failures do not prevent Wishlist refresh", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  refreshDiscovery.mockRejectedValueOnce(new Error("Provider down"));
  expect(await (await call("Bearer s3cret")).json()).toEqual({
    checked: 7,
    discovery: "failed",
  });
});

test("overlapping or immediate repeat invocations skip both refreshes", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  claimScheduledRefresh.mockResolvedValueOnce(false);
  expect(await (await call("Bearer s3cret")).json()).toEqual({ skipped: true });
  expect(refreshReleaseDates).not.toHaveBeenCalled();
  expect(refreshDiscovery).not.toHaveBeenCalled();
});

test("discovery waits for Wishlist writes to settle before starting", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  let finish!: (value: number) => void;
  refreshReleaseDates.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const response = call("Bearer s3cret");
  await vi.waitFor(() => expect(refreshReleaseDates).toHaveBeenCalled());
  const startedEarly = refreshDiscovery.mock.calls.length > 0;
  finish(7);
  expect(await (await response).json()).toEqual({
    checked: 7,
    discovery: { recent: 4, popular: 4 },
  });
  expect(startedEarly).toBe(false);
});
