import { afterEach, expect, test, vi } from "vitest";
import { createCatalog } from "@/lib/catalog";
import { createTestDb } from "@/test/db";
import { createFakeGameSource } from "@/test/fake-game-source";

afterEach(() => vi.useRealTimers());

test("successful empty daily tasks have durable healthy baselines", async () => {
  const db = await createTestDb();
  const catalog = createCatalog(db, createFakeGameSource([]));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T06:00:00Z"));
  expect(await catalog.runScheduledRefresh()).toMatchObject({
    outcome: "success",
    checked: 0,
    discovery: { recent: 0, popular: 0 },
  });
  const restarted = createCatalog(db, createFakeGameSource([]));
  const health = await restarted.refreshHealth();
  expect(health.healthy).toBe(true);
  expect(health.tasks).toHaveLength(3);
  expect(
    health.tasks.every(
      (task) =>
        task.lastSuccessAt?.toISOString() === "2026-11-10T06:00:00.000Z",
    ),
  ).toBe(true);
});

test("failed selection keeps its last success; Discovery recovery leaves Wishlist evidence alone", async () => {
  const db = await createTestDb();
  const source = createFakeGameSource([]);
  const catalog = createCatalog(db, source);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T06:00:00Z"));
  await catalog.runScheduledRefresh();
  vi.setSystemTime(new Date("2026-11-11T06:00:00Z"));
  const fault = vi
    .spyOn(source, "fetchRecentCandidates")
    .mockRejectedValue(new Error("private provider response"));
  expect(await catalog.runScheduledRefresh()).toMatchObject({
    outcome: "partial",
    checked: 0,
    discovery: { recent: "failed", popular: 0 },
  });
  const health = await catalog.refreshHealth();
  expect(health.tasks.find((task) => task.key === "recent")).toMatchObject({
    outcome: "failure",
    lastSuccessAt: new Date("2026-11-10T06:00:00Z"),
    finishedAt: new Date("2026-11-11T06:00:00Z"),
  });
  expect(
    health.tasks.find((task) => task.key === "popular")?.lastSuccessAt,
  ).toEqual(new Date("2026-11-11T06:00:00Z"));
  expect(
    await catalog.refreshHealth(new Date("2026-11-11T12:00:00Z")),
  ).toMatchObject({
    healthy: false,
    tasks: expect.arrayContaining([
      expect.objectContaining({ key: "recent", freshness: "stale" }),
      expect.objectContaining({ key: "popular", freshness: "healthy" }),
    ]),
  });
  fault.mockRestore();
  vi.setSystemTime(new Date("2026-11-11T12:01:00Z"));
  await catalog.refreshDiscovery();
  expect(
    (await catalog.refreshHealth()).tasks.find(
      (task) => task.key === "wishlist",
    )?.lastSuccessAt,
  ).toEqual(new Date("2026-11-11T06:00:00Z"));
  expect(
    (await catalog.refreshHealth()).tasks.find((task) => task.key === "recent")
      ?.lastSuccessAt,
  ).toEqual(new Date("2026-11-11T12:01:00Z"));
});

test("freshness missing-baseline grace starts at migration time, never on a health read", async () => {
  const db = await createTestDb();
  const catalog = createCatalog(db, createFakeGameSource([]));
  const initial = await catalog.refreshHealth();
  const enabledAt = initial.tasks[0].enabledAt;
  if (!enabledAt) throw new Error("Migration baseline missing");
  expect(initial).toMatchObject({
    healthy: true,
    tasks: expect.arrayContaining([
      expect.objectContaining({ freshness: "pending", lastSuccessAt: null }),
    ]),
  });
  expect(
    await catalog.refreshHealth(
      new Date(enabledAt.getTime() + 30 * 3600000 - 1),
    ),
  ).toMatchObject({ healthy: true });
  expect(
    await createCatalog(db, createFakeGameSource([])).refreshHealth(
      new Date(enabledAt.getTime() + 30 * 3600000),
    ),
  ).toMatchObject({ healthy: false });
});

test("telemetry failure cannot prevent refresh work or change persisted success", async () => {
  const catalog = createCatalog(await createTestDb(), createFakeGameSource([]));
  const log = vi.spyOn(console, "info").mockImplementation(() => {
    throw new Error("log transport unavailable");
  });
  try {
    expect(await catalog.runScheduledRefresh()).toMatchObject({
      outcome: "success",
    });
    expect(
      (await catalog.refreshHealth()).tasks.every(
        (task) => task.outcome === "success",
      ),
    ).toBe(true);
  } finally {
    log.mockRestore();
  }
});

test("scheduled deadline finalizes failures and ignores late Wishlist provider results", async () => {
  const { game, journalEntry, user } = await import("@/db/schema");
  const db = await createTestDb();
  await db.insert(game).values({
    id: 900,
    title: "Synthetic",
    slug: "synthetic",
    genres: [],
    platforms: [],
    syncedAt: new Date(),
  });
  await db.insert(user).values({
    id: "deadline",
    name: "Synthetic",
    email: "deadline@example.test",
  });
  await db.insert(journalEntry).values({
    userId: "deadline",
    gameId: 900,
    status: "wishlist",
    updatedAt: new Date(),
  });
  const source = createFakeGameSource([]);
  const controller = new AbortController();
  let finish!: (
    value: Map<number, import("@/lib/game-source").SourceReleaseDate[]>,
  ) => void;
  vi.spyOn(source, "fetchReleaseDates").mockImplementation(() => {
    controller.abort(new DOMException("Deadline", "TimeoutError"));
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const recent = vi.spyOn(source, "fetchRecentCandidates");
  const catalog = createCatalog(db, source);
  expect(await catalog.runScheduledRefresh(controller.signal)).toMatchObject({
    outcome: "failure",
    checked: "failed",
    discovery: { recent: "failed", popular: "failed" },
  });
  const health = await catalog.refreshHealth();
  expect(health.invocation).toMatchObject({
    outcome: "failure",
    finishedAt: expect.any(Date),
  });
  expect(
    health.tasks.every(
      (task) =>
        task.outcome === "failure" && task.finishedAt && !task.lastSuccessAt,
    ),
  ).toBe(true);
  expect(recent).not.toHaveBeenCalled();
  finish(
    new Map([
      [
        900,
        [
          {
            platform: null,
            region: "worldwide",
            precision: "day",
            status: null,
            date: new Date("2030-01-01"),
          },
        ],
      ],
    ]),
  );
  expect((await catalog.findBySlug("synthetic"))?.releaseDates).toEqual([]);
});
