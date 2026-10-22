import { afterEach, expect, test, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { createFakeGameSource, sourceGame } from "@/test/fake-game-source";
import { createCatalog } from "./catalog";

afterEach(() => {
  vi.useRealTimers();
});

test("a query the catalog hasn't seen falls back to the game source", async () => {
  const source = createFakeGameSource([
    sourceGame({
      id: 1,
      title: "Hollow Knight",
      coverImageId: "co1rgi",
      platforms: ["PC", "Nintendo Switch"],
      releaseDates: [
        {
          platform: "PC",
          region: "worldwide",
          date: new Date("2017-02-24"),
          precision: "day",
          status: "Full Release",
        },
      ],
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);

  expect(await catalog.search("hollow")).toEqual([
    {
      id: 1,
      title: "Hollow Knight",
      slug: "game-1",
      coverImageId: "co1rgi",
      year: 2017,
      platforms: ["PC", "Nintendo Switch"],
    },
  ]);
});

test("a repeated query is served from the catalog for 24 hours", async () => {
  const source = createFakeGameSource([sourceGame({ title: "Celeste" })]);
  const catalog = createCatalog(await createTestDb(), source);
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

  const first = await catalog.search("celeste");
  vi.setSystemTime(new Date("2026-01-01T23:59:00Z"));
  const again = await catalog.search("  Celeste ");

  expect(again).toEqual(first);
  expect(source.searches).toBe(1);

  vi.setSystemTime(new Date("2026-01-02T00:01:00Z"));
  await catalog.search("celeste");
  expect(source.searches).toBe(2);
});

test("only main games, standalone expansions and remakes are kept", async () => {
  const source = createFakeGameSource([
    sourceGame({ title: "Resident Evil 2", type: "main_game" }),
    sourceGame({ title: "Resident Evil 2", type: "remake" }),
    sourceGame({
      title: "Resident Evil 2: Ghost Survivors",
      type: "dlc_addon",
    }),
    sourceGame({ title: "Resident Evil 2 Remastered", type: "remaster" }),
    sourceGame({ title: "Resident Evil 2 (Switch)", type: "port" }),
    sourceGame({
      title: "Resident Evil 2 Deluxe Edition",
      type: "expanded_game",
    }),
    sourceGame({ title: "Resident Evil 2 + 3 Bundle", type: "bundle" }),
    sourceGame({
      title: "Resident Evil 2: Extra Chapter",
      type: "standalone_expansion",
    }),
  ]);
  const catalog = createCatalog(await createTestDb(), source);

  const titles = (await catalog.search("resident evil 2")).map((r) => r.title);

  expect(titles).toEqual([
    "Resident Evil 2",
    "Resident Evil 2",
    "Resident Evil 2: Extra Chapter",
  ]);
});
