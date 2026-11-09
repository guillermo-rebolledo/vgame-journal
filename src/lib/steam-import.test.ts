import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { steamLink, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createFakeGameSource, sourceGame } from "@/test/fake-game-source";
import { createJournal } from "./journal";
import type { SteamRead } from "./steam";
import { createSteamImport } from "./steam-import";

let db: Awaited<ReturnType<typeof createTestDb>>;
let read: ReturnType<typeof vi.fn<() => Promise<SteamRead>>>;
let importer: ReturnType<typeof createSteamImport>;
afterEach(() => vi.useRealTimers());
const games = Array.from({ length: 8 }, (_, i) => sourceGame({ id: i + 1 }));
beforeEach(async () => {
  db = await createTestDb();
  await db
    .insert(user)
    .values({ id: "mario", name: "Mario", email: "mario@example.com" });
  read = vi.fn(async () => ({
    kind: "games" as const,
    games: Array.from({ length: 9 }, (_, i) => ({
      appid: i + 100,
      name: `Steam ${i}`,
      playtime: i,
      lastPlayed: i,
    })),
  }));
  const mappings = [
    { appid: 100, gameId: 1, type: "main_game" as const },
    { appid: 101, gameId: 2, type: "main_game" as const },
    { appid: 102, gameId: 3, type: "main_game" as const },
    { appid: 103, gameId: 4, type: "remaster" as const, parentGame: 1 },
    { appid: 104, gameId: 5, type: "bundle" as const },
    { appid: 105, gameId: 6, type: "dlc_addon" as const },
    { appid: 106, gameId: 7, type: "main_game" as const, versionParent: 1 },
    { appid: 108, gameId: 8, type: "port" as const, parentGame: 1 },
  ];
  importer = createSteamImport(db, createFakeGameSource(games, mappings), read);
  await importer.link("mario", "76561198000000000");
});
test("read normalizes editions, deduplicates and classifies without Catalog writes", async () => {
  const { createCatalog } = await import("./catalog");
  await createCatalog(db, createFakeGameSource(games)).save(games.slice(1, 3));
  const journal = createJournal(db);
  await journal.set("mario", 2, { status: "playing" });
  await journal.set("mario", 3, { status: "backlog" });
  await journal.remove("mario", 3);
  const result = await importer.review("mario");
  expect(result.kind).toBe("review");
  if (result.kind !== "review") throw new Error("No review");
  expect(result.rows.map((row) => [row.appid, row.state])).toEqual([
    [100, "ready"],
    [101, "existing"],
    [102, "removed"],
    [104, "needs_look"],
    [107, "unmatched"],
  ]);
  expect(await journal.entry("mario", 1)).toBeNull();
});
test("a conditional cooldown admits one concurrent read and expires after 60 seconds", async () => {
  const results = await Promise.all([
    importer.review("mario"),
    importer.review("mario"),
  ]);
  expect(read).toHaveBeenCalledOnce();
  expect(results.map((r) => r.kind).sort()).toEqual(["cooldown", "review"]);
  await db.update(steamLink).set({ nextImportAt: new Date(0) });
  expect((await importer.review("mario")).kind).toBe("review");
});
test.each([
  "hidden",
  "empty",
  "too_many",
] as const)("preserves %s response", async (kind) => {
  read.mockResolvedValue({ kind });
  expect(await importer.review("mario")).toEqual({ kind });
});
test("commit remaps untrusted appids, adds only ready games, and extends cooldown", async () => {
  expect(
    await importer.commit("mario", [100, 103, 104, 105, 107, 100]),
  ).toEqual({ added: 1, feedbackInvitation: true });
  expect((await createJournal(db).entry("mario", 1))?.status).toBe("backlog");
  await expect(importer.commit("mario", [100])).rejects.toThrow();
  const [link] = await db
    .select()
    .from(steamLink)
    .where(eq(steamLink.userId, "mario"));
  expect(link.nextImportAt?.getTime()).toBeGreaterThan(Date.now() + 290_000);
  await importer.unlink("mario");
  expect(await importer.connection("mario")).toBeNull();
  expect(await createJournal(db).entry("mario", 1)).not.toBeNull();
});
test.each([
  [0],
  [-1],
  [1.5],
  ["100"],
  Array.from({ length: 10_001 }, (_, i) => i + 1),
])("rejects invalid selections", async (...args) => {
  await expect(importer.commit("mario", args)).rejects.toThrow();
});
test("upstream failure never writes entries", async () => {
  read.mockRejectedValue(new Error("Offline"));
  expect(await importer.review("mario")).toEqual({ kind: "unavailable" });
  expect((await createJournal(db).exportData("mario")).entries).toEqual([]);
});

test("ambiguous external IDs stay unmatched; DLC is excluded and a parented bundle uses its base", async () => {
  const importer = createSteamImport(
    db,
    createFakeGameSource(games, [
      { appid: 1, gameId: 1, type: "main_game" },
      { appid: 1, gameId: 2, type: "main_game" },
      { appid: 2, gameId: 3, type: "bundle", parentGame: 4 },
      { appid: 3, gameId: 5, type: "expansion" },
    ]),
    async () => ({
      kind: "games",
      games: [1, 2, 3].map((appid) => ({
        appid,
        name: `Game ${appid}`,
        playtime: 0,
        lastPlayed: 0,
      })),
    }),
  );
  const result = await importer.review("mario");
  expect(result).toMatchObject({
    kind: "review",
    rows: [
      { appid: 1, gameId: null, state: "unmatched" },
      { appid: 2, gameId: 4, state: "ready" },
    ],
  });
});

test("oversized reads stop before matching and incomplete Catalog data leaves the Journal untouched", async () => {
  read.mockResolvedValueOnce({
    kind: "games",
    games: Array.from({ length: 10_001 }, (_, i) => ({
      appid: i + 1,
      name: "Game",
      playtime: 0,
      lastPlayed: 0,
    })),
  });
  expect(await importer.review("mario")).toEqual({ kind: "too_many" });
  const unavailable = createSteamImport(
    db,
    createFakeGameSource([], [{ appid: 1, gameId: 999, type: "main_game" }]),
    read,
  );
  await db.update(steamLink).set({ nextImportAt: null });
  await expect(unavailable.commit("mario", [1])).rejects.toThrow(
    "Incomplete Catalog response",
  );
  expect((await createJournal(db).exportData("mario")).entries).toEqual([]);
});

test("disconnecting before the atomic import prevents stale review additions", async () => {
  const journal = createJournal(db);
  const { createCatalog } = await import("./catalog");
  await createCatalog(db, createFakeGameSource(games)).save(games.slice(0, 1));
  await importer.unlink("mario");
  expect(
    (await journal.importGames("mario", [1], "76561198000000000")).added,
  ).toBe(0);
});

test("10,000 imported entries keep counts, history and Library consistent", async () => {
  const { createCatalog } = await import("./catalog");
  const large = Array.from({ length: 10_000 }, (_, i) =>
    sourceGame({ id: 50_000 + i }),
  );
  const catalog = createCatalog(db, createFakeGameSource(large));
  for (let start = 0; start < large.length; start += 500)
    await catalog.save(large.slice(start, start + 500));
  const journal = createJournal(db);
  expect(
    await journal.importGames(
      "mario",
      large.map((g) => g.id),
    ),
  ).toEqual({ added: 10_000, feedbackInvitation: true });
  expect(
    await journal.importGames(
      "mario",
      large.map((g) => g.id),
    ),
  ).toEqual({ added: 0, feedbackInvitation: false });
  const exported = await journal.exportData("mario");
  expect(exported.entries).toHaveLength(10_000);
  expect(exported.statusHistory).toHaveLength(10_000);
  expect(exported.playthroughs).toHaveLength(0);
  expect(await journal.library("mario", { status: "backlog" })).toHaveLength(
    10_000,
  );
}, 30_000);

test("successful imports enforce the entire five-minute cooldown", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const started = Date.now();
  await importer.commit("mario", [100]);
  vi.setSystemTime(started + 240_000);
  await expect(importer.commit("mario", [100])).rejects.toThrow();
  vi.setSystemTime(started + 300_001);
  expect((await importer.commit("mario", [100])).added).toBe(0);
});

test("a running commit blocks later commits and cannot overwrite a newer review lease", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const now = Date.now();
  const mapping = [{ appid: 100, gameId: 1, type: "main_game" as const }];
  let release!: (rows: typeof mapping) => void;
  let announce!: () => void;
  const started = new Promise<void>((resolve) => {
    announce = resolve;
  });
  const source = createFakeGameSource(games, mapping);
  source.mapSteamApps = async () => {
    announce();
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  const slow = createSteamImport(db, source, read);
  const first = slow.commit("mario", [100]);
  await started;
  vi.setSystemTime(now + 120_000);
  await expect(importer.commit("mario", [100])).rejects.toThrow();
  vi.setSystemTime(now + 180_001);
  expect((await importer.review("mario")).kind).toBe("review");
  const before = await importer.connection("mario");
  release(mapping);
  expect((await first).added).toBe(1);
  expect(await importer.connection("mario")).toEqual(before);
});
