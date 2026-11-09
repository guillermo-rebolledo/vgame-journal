import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createCatalog } from "@/lib/catalog";
import { createTestDb } from "@/test/db";
import { createFakeGameSource, type sourceGame } from "@/test/fake-game-source";

const state = vi.hoisted(() => ({
  catalog: null as unknown as ReturnType<typeof createCatalog>,
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    catalog: {
      runScheduledRefresh: () => state.catalog.runScheduledRefresh(),
      refreshHealth: () => state.catalog.refreshHealth(),
    },
  };
});
const { GET } = await import("./route");
const { GET: health } = await import("../refresh-health/route");
const request = (authorization?: string) =>
  new Request("http://localhost/api/cron/refresh-release-dates", {
    headers: authorization ? { authorization } : {},
  });
const call = (authorization = "Bearer secret") => GET(request(authorization));
let source: ReturnType<typeof createFakeGameSource>;

beforeEach(async () => {
  vi.stubEnv("CRON_SECRET", "secret");
  source = createFakeGameSource([]);
  state.catalog = createCatalog(await createTestDb(), source);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T06:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("refresh and health require the configured cron secret", async () => {
  for (const route of [GET, health]) {
    expect((await route(request())).status).toBe(401);
    expect((await route(request("Bearer wrong"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await route(request("Bearer "))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "secret");
  }
  expect(
    (await state.catalog.refreshHealth()).invocation?.startedAt,
  ).toBeNull();
});

test("successful empty refresh preserves consumer fields and makes all tasks healthy", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    outcome: "success",
    checked: 0,
    discovery: { recent: 0, popular: 0 },
  });
  const responseHealth = await health(request("Bearer secret"));
  expect(responseHealth.status).toBe(200);
  expect(await responseHealth.json()).toMatchObject({
    healthy: true,
    tasks: expect.arrayContaining([
      expect.objectContaining({
        key: "wishlist",
        outcome: "success",
        lastSuccessAt: "2026-11-10T06:00:00.000Z",
      }),
    ]),
  });
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  const stale = await health(request("Bearer secret"));
  expect(stale.status).toBe(503);
  expect(await stale.json()).toMatchObject({ healthy: false });
});

test("a failed selection returned as a value is partial HTTP failure", async () => {
  const events = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(source, "fetchRecentCandidates").mockRejectedValue(
    new Error("private details"),
  );
  const response = await call();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    outcome: "partial",
    checked: 0,
    discovery: { recent: "failed", popular: 0 },
  });
  expect(events.mock.calls.flat()).toContainEqual(
    expect.objectContaining({
      event: "scheduled_refresh",
      operation: "recent",
      outcome: "failure",
      code: "refresh_failed",
      correlationId: expect.any(String),
      timestamp: "2026-11-10T06:00:00.000Z",
    }),
  );
  expect(JSON.stringify(events.mock.calls)).not.toContain("private details");
});

test("a Wishlist failure still refreshes both Discovery selections", async () => {
  const db = await createTestDb();
  const { game, journalEntry, user } = await import("@/db/schema");
  await db.insert(game).values({
    id: 1,
    title: "Game",
    slug: "game",
    genres: [],
    platforms: [],
    syncedAt: new Date(),
  });
  await db.insert(user).values({
    id: "synthetic",
    name: "Synthetic",
    email: "synthetic@example.test",
  });
  await db.insert(journalEntry).values({
    userId: "synthetic",
    gameId: 1,
    status: "wishlist",
    updatedAt: new Date(),
  });
  state.catalog = createCatalog(db, source);
  vi.spyOn(source, "fetchReleaseDates").mockRejectedValue(
    new Error("private provider response"),
  );
  const response = await call();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    outcome: "partial",
    checked: "failed",
    discovery: { recent: 0, popular: 0 },
  });
  expect(
    (await state.catalog.refreshHealth()).tasks.find(
      (task) => task.key === "wishlist",
    ),
  ).toMatchObject({ outcome: "failure", lastSuccessAt: null });
  vi.spyOn(source, "fetchRecentCandidates").mockRejectedValue(
    new Error("private response"),
  );
  vi.spyOn(source, "fetchDiscoveryRanks").mockRejectedValue(
    new Error("private response"),
  );
  vi.setSystemTime(new Date("2026-11-10T06:05:00Z"));
  const failed = await call();
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({
    outcome: "failure",
    checked: "failed",
    discovery: { recent: "failed", popular: "failed" },
  });
});

test("overlap is skipped durably without replacing running or last-success evidence", async () => {
  let finish!: (value: {
    games: ReturnType<typeof sourceGame>[];
    hasMore: boolean;
  }) => void;
  let started!: () => void;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(source, "fetchRecentCandidates").mockImplementationOnce(() => {
    started();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = call();
  await running;
  expect((await state.catalog.refreshHealth()).invocation?.outcome).toBe(
    "running",
  );
  const overlap = await call();
  expect(overlap.status).toBe(200);
  expect(await overlap.json()).toEqual({ outcome: "skipped", skipped: true });
  expect((await state.catalog.refreshHealth()).invocation).toMatchObject({
    outcome: "running",
    lastSkippedAt: new Date("2026-11-10T06:00:00Z"),
    lastSuccessAt: null,
  });
  finish({ games: [], hasMore: false });
  expect((await first).status).toBe(200);
  const before = await state.catalog.refreshHealth();
  await call();
  expect((await state.catalog.refreshHealth()).tasks).toEqual(before.tasks);
  vi.setSystemTime(new Date("2026-11-10T06:05:00Z"));
  expect(await (await call()).json()).toMatchObject({ outcome: "success" });
});

test("unavailable durable storage fails both protected HTTP reads without leaking errors", async () => {
  const db = await createTestDb();
  state.catalog = createCatalog(db, source);
  await db.$client.close();
  const response = await call();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    outcome: "failure",
    code: "refresh_unavailable",
  });
  const responseHealth = await health(request("Bearer secret"));
  expect(responseHealth.status).toBe(503);
  expect(await responseHealth.json()).toEqual({
    healthy: false,
    code: "refresh_health_unavailable",
  });
});
