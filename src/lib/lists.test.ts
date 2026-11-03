import { randomUUID } from "node:crypto";
import { beforeEach, expect, test } from "vitest";
import type { Db } from "@/db";
import { game, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createLists } from "./lists";

let db: Db;
let lists: ReturnType<typeof createLists>;
beforeEach(async () => {
  db = await createTestDb();
  lists = createLists(db);
  await db.insert(user).values(
    ["mario", "luigi"].map((id) => ({
      id,
      name: id,
      username: id,
      email: `${id}@example.com`,
      feedToken: `${id}-secret`,
    })),
  );
  await db.insert(game).values(
    [1, 2, 3].map((id) => ({
      id,
      title: `Game ${id}`,
      slug: `game-${id}`,
      genres: [],
      platforms: ["PC"],
      syncedAt: new Date(),
    })),
  );
});

test("creation defaults to Private and a submission retry retrieves the same list only for that actor", async () => {
  const input = {
    title: "  Favorites  ",
    description: "Line one\nLine two",
    submissionId: randomUUID(),
  };
  const created = await lists.create("mario", input);
  expect(created).toMatchObject({
    ok: true,
    value: { title: "Favorites", visibility: "private", revision: 0 },
  });
  if (!created.ok) throw new Error("Creation failed");
  expect(await lists.ownerDetail("mario", created.value.id)).toMatchObject({
    description: "Line one\nLine two",
    games: [],
  });
  expect(
    await lists.create("mario", {
      ...input,
      title: "Retry must not overwrite",
    }),
  ).toEqual(created);
  const other = await lists.create("luigi", input);
  expect(other).toMatchObject({ ok: true });
  if (!other.ok) throw new Error("Creation failed");
  expect(other.value.id).not.toBe(created.value.id);
  expect(await lists.ownerCollection("mario")).toHaveLength(1);
  expect(await lists.ownerDetail("luigi", created.value.id)).toBeNull();
  expect(await lists.publicDetail("mario", created.value.id)).toBeNull();
  expect(await lists.publicCollection("mario")).toEqual([]);
});

async function saved(
  actor = "mario",
  visibility: "private" | "public" = "private",
) {
  const result = await lists.create(actor, {
    title: "Favorites",
    visibility,
    submissionId: randomUUID(),
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

test("publication is revisioned, public reads are allowlisted and stale edits cannot republish", async () => {
  const list = await saved();
  expect(await lists.setVisibility("mario", list.id, 0, "public")).toEqual({
    ok: true,
    value: { revision: 1, changed: true },
  });
  const publicList = await lists.publicDetail("MARIO", list.id);
  expect(publicList).toEqual({
    id: list.id,
    title: "Favorites",
    description: "",
    creator: { username: "mario", image: null },
    createdAt: list.createdAt,
    updatedAt: expect.any(Date),
    games: [],
    gameCount: 0,
  });
  expect(await lists.publicDetail("luigi", list.id)).toBeNull();
  expect(await lists.publicDetail("mario", "invalid")).toBeNull();
  expect(
    await lists.edit("mario", list.id, 1, {
      title: "Renamed",
      description: "Plain <b>text</b>\nAnd lines",
    }),
  ).toMatchObject({ ok: true, value: { revision: 2 } });
  expect(
    await lists.setVisibility("mario", list.id, 2, "private"),
  ).toMatchObject({ ok: true, value: { revision: 3 } });
  expect(
    await lists.edit("mario", list.id, 1, { title: "Old tab" }),
  ).toMatchObject({ ok: false, code: "conflict" });
  expect(
    await lists.setVisibility("mario", list.id, 2, "public"),
  ).toMatchObject({ ok: false, code: "conflict" });
  expect(await lists.publicDetail("mario", list.id)).toBeNull();
  expect(await lists.publicCollection("mario")).toEqual([]);
  expect(await lists.ownerDetail("mario", list.id)).toMatchObject({
    title: "Renamed",
    revision: 3,
    description: "Plain <b>text</b>\nAnd lines",
    visibility: "private",
  });
});

test("Catalog membership appends and deduplicates across overlapping lists without touching the Journal", async () => {
  const list = await saved();
  const other = await saved();
  expect(await lists.addGame("mario", list.id, 0, 2)).toEqual({
    ok: true,
    value: { revision: 1, changed: true },
  });
  expect(await lists.addGame("mario", list.id, 1, 1)).toEqual({
    ok: true,
    value: { revision: 2, changed: true },
  });
  const before = await lists.ownerDetail("mario", list.id);
  expect(await lists.addGame("mario", list.id, 2, 2)).toEqual({
    ok: true,
    value: { revision: 2, changed: false },
  });
  expect(await lists.ownerDetail("mario", list.id)).toEqual(before);
  expect(await lists.addGame("mario", other.id, 0, 2)).toMatchObject({
    ok: true,
  });
  expect(await lists.addGame("mario", list.id, 2, 999)).toMatchObject({
    ok: false,
    code: "validation",
  });
  expect((await lists.ownerDetail("mario", list.id))?.games).toEqual([
    { gameId: 2, title: "Game 2", slug: "game-2", coverImageId: null },
    { gameId: 1, title: "Game 1", slug: "game-1", coverImageId: null },
  ]);
  expect((await lists.ownerDetail("mario", other.id))?.gameCount).toBe(1);
});

test("reordering requires exactly the current membership and removal only changes its target list", async () => {
  const list = await saved("mario", "public");
  for (const [revision, gameId] of [1, 2, 3].entries())
    expect(
      await lists.addGame("mario", list.id, revision, gameId),
    ).toMatchObject({ ok: true });
  const before = await lists.ownerDetail("mario", list.id);
  for (const order of [
    [1, 2],
    [1, 2, 2],
    [1, 2, 999],
  ]) {
    expect(await lists.reorder("mario", list.id, 3, order)).toMatchObject({
      ok: false,
      code: "validation",
    });
    expect(await lists.ownerDetail("mario", list.id)).toEqual(before);
  }
  expect(await lists.reorder("mario", list.id, 3, [3, 1, 2])).toEqual({
    ok: true,
    value: { revision: 4, changed: true },
  });
  expect(
    (await lists.publicDetail("mario", list.id))?.games.map((g) => g.gameId),
  ).toEqual([3, 1, 2]);
  expect(await lists.reorder("mario", list.id, 4, [3, 1, 2])).toEqual({
    ok: true,
    value: { revision: 4, changed: false },
  });
  expect(await lists.removeGame("mario", list.id, 4, 1)).toEqual({
    ok: true,
    value: { revision: 5, changed: true },
  });
  expect(await lists.removeGame("mario", list.id, 5, 1)).toEqual({
    ok: true,
    value: { revision: 5, changed: false },
  });
  expect(await lists.addGame("mario", list.id, 5, 1)).toMatchObject({
    ok: true,
    value: { revision: 6 },
  });
  expect(
    (await lists.ownerDetail("mario", list.id))?.games.map((g) => g.gameId),
  ).toEqual([3, 2, 1]);
});

test("deletion checks actor and revision and preserves other lists and shared Catalog games", async () => {
  const list = await saved("mario", "public");
  const survivor = await saved("luigi", "public");
  await lists.addGame("mario", list.id, 0, 1);
  await lists.addGame("luigi", survivor.id, 0, 1);
  const before = await lists.ownerDetail("luigi", survivor.id);
  expect(await lists.delete("luigi", list.id, 1)).toMatchObject({
    ok: false,
    code: "not_found",
  });
  expect(await lists.delete("mario", list.id, 0)).toMatchObject({
    ok: false,
    code: "conflict",
  });
  expect(await lists.delete("mario", list.id, 1)).toMatchObject({ ok: true });
  expect(await lists.ownerDetail("mario", list.id)).toBeNull();
  expect(await lists.publicDetail("mario", list.id)).toBeNull();
  expect(await lists.ownerDetail("luigi", survivor.id)).toEqual(before);
  const fresh = await saved();
  expect(await lists.addGame("mario", fresh.id, 0, 1)).toMatchObject({
    ok: true,
  });
});

test("concurrent creators retry one submission and competing revisions permit only one winner", async () => {
  const input = { title: "One uncertain save", submissionId: randomUUID() };
  const creations = await Promise.all(
    Array.from({ length: 5 }, () => lists.create("mario", input)),
  );
  expect(creations.every((r) => r.ok)).toBe(true);
  expect(await lists.ownerCollection("mario")).toHaveLength(1);
  const first = creations[0];
  if (!first.ok) throw new Error(first.message);
  expect(new Set(creations.flatMap((r) => (r.ok ? [r.value.id] : [])))).toEqual(
    new Set([first.value.id]),
  );
  const outcomes = await Promise.all([
    lists.edit("mario", first.value.id, 0, { title: "Edited" }),
    lists.setVisibility("mario", first.value.id, 0, "public"),
    lists.addGame("mario", first.value.id, 0, 1),
  ]);
  expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
  expect(outcomes.filter((r) => !r.ok && r.code === "conflict")).toHaveLength(
    2,
  );
  expect(await lists.ownerDetail("mario", first.value.id)).toMatchObject({
    revision: 1,
  });
});

test("all mutations reject nonowners and unauthenticated callers without changing the list", async () => {
  const list = await saved();
  for (const actor of ["luigi", null]) {
    const results = await Promise.all([
      lists.edit(actor, list.id, 0, { title: "Intrusion" }),
      lists.setVisibility(actor, list.id, 0, "public"),
      lists.addGame(actor, list.id, 0, 1),
      lists.removeGame(actor, list.id, 0, 1),
      lists.reorder(actor, list.id, 0, []),
      lists.delete(actor, list.id, 0),
    ]);
    for (const result of results)
      expect(result).toEqual({
        ok: false,
        code: actor ? "not_found" : "authentication",
        message: expect.any(String),
      });
  }
  expect(await lists.ownerDetail("mario", list.id)).toEqual(list);
  expect(
    await lists.create(null, { title: "No actor", submissionId: randomUUID() }),
  ).toMatchObject({ ok: false, code: "authentication" });
  expect(
    await lists.create("nonexistent", {
      title: "No user",
      submissionId: randomUUID(),
    }),
  ).toMatchObject({ ok: false, code: "authentication" });
});

test("untrusted mutation inputs fail safely without changing persisted data", async () => {
  const list = await saved();
  const base = { title: "Valid", submissionId: randomUUID() };
  for (const input of [
    null,
    { ...base, title: " \n " },
    { ...base, title: "x".repeat(101) },
    { ...base, title: 1 },
    { ...base, description: null },
    { ...base, description: "x".repeat(2001) },
    { ...base, visibility: "friends" },
    { ...base, submissionId: "invalid" },
  ]) {
    expect(
      await lists.create("mario", JSON.parse(JSON.stringify(input))),
    ).toMatchObject({ ok: false, code: "validation" });
  }
  for (const input of [
    null,
    { title: " " },
    { title: "x".repeat(101) },
    { title: "Valid", description: 1 },
    { title: "Valid", description: "x".repeat(2001) },
  ]) {
    expect(
      await lists.edit("mario", list.id, 0, JSON.parse(JSON.stringify(input))),
    ).toMatchObject({ ok: false, code: "validation" });
  }
  for (const revision of [-1, 0.5, "0", null, NaN, 2147483647])
    expect(
      await lists.setVisibility("mario", list.id, revision, "public"),
    ).toMatchObject({ ok: false, code: "validation" });
  for (const gameId of [null, "1", -1, 0, 1.5, 2147483648]) {
    expect(await lists.addGame("mario", list.id, 0, gameId)).toMatchObject({
      ok: false,
      code: "validation",
    });
    expect(await lists.removeGame("mario", list.id, 0, gameId)).toMatchObject({
      ok: false,
      code: "validation",
    });
  }
  for (const order of [null, "1", [null], [1, 1], [1.5], ["1"]])
    expect(await lists.reorder("mario", list.id, 0, order)).toMatchObject({
      ok: false,
      code: "validation",
    });
  expect(
    await lists.setVisibility("mario", list.id, 0, "friends"),
  ).toMatchObject({ ok: false, code: "validation" });
  for (const id of [null, "not-a-uuid", randomUUID()]) {
    expect(await lists.ownerDetail("mario", id)).toBeNull();
    expect(await lists.delete("mario", id, 0)).toMatchObject({
      ok: false,
      code: "not_found",
    });
  }
  expect(await lists.ownerCollection("mario")).toEqual([list]);
});

test("a failed revision write rolls back membership and returns no database details", async () => {
  const list = await saved();
  const { sql } = await import("drizzle-orm");
  await db.execute(
    sql`create function reject_list_write() returns trigger language plpgsql as $$ begin raise exception 'private database failure'; end $$`,
  );
  await db.execute(
    sql`create trigger reject_list_write before update on custom_list for each row execute function reject_list_write()`,
  );
  expect(await lists.addGame("mario", list.id, 0, 1)).toEqual({
    ok: false,
    code: "unavailable",
    message: "Lists are unavailable. Please try again.",
  });
  expect(await lists.ownerDetail("mario", list.id)).toEqual(list);
  await db.execute(sql`drop trigger reject_list_write on custom_list`);
  expect(await lists.addGame("mario", list.id, 0, 1)).toEqual({
    ok: true,
    value: { revision: 1, changed: true },
  });
});

test("read failures are reported as unavailable rather than empty collections or raw database errors", async () => {
  const { sql } = await import("drizzle-orm");
  const list = await saved("mario", "public");
  await db.execute(
    sql`alter table custom_list rename to temporarily_unavailable`,
  );
  for (const read of [
    () => lists.ownerCollection("mario"),
    () => lists.ownerDetail("mario", list.id),
    () => lists.publicCollection("mario"),
    () => lists.publicDetail("mario", list.id),
  ])
    await expect(read()).rejects.toThrow(
      /^Lists are unavailable\. Please try again\.$/,
    );
});

test("list changes and Journal changes remain independent, including Playthroughs and Wishlist", async () => {
  const { createJournal } = await import("./journal");
  const journal = createJournal(db);
  const list = await saved();
  await journal.set("mario", 1, {
    status: "played",
    completionTag: "completed",
  });
  await journal.addPlaythrough("mario", 1, {
    platform: "PC",
    startedOn: "2026-01-01",
    notes: "Private notes",
  });
  await journal.set("mario", 2, { status: "wishlist" });
  const before = await journal.exportData("mario");
  await lists.addGame("mario", list.id, 0, 1);
  await lists.addGame("mario", list.id, 1, 2);
  await lists.addGame("mario", list.id, 2, 3);
  expect(await journal.entry("mario", 3)).toBeNull();
  const after = await journal.exportData("mario");
  for (const key of ["entries", "playthroughs", "statusHistory"] as const)
    expect(after[key]).toEqual(before[key]);
  await journal.remove("mario", 1, true);
  expect(
    (await lists.ownerDetail("mario", list.id))?.games.map((g) => g.gameId),
  ).toEqual([1, 2, 3]);
  await lists.delete("mario", list.id, 3);
  expect(await journal.entry("mario", 2)).toMatchObject({ status: "wishlist" });
});

test("public collections expose only public lists, Catalog fields and ordered previews", async () => {
  const secret = await lists.create("mario", {
    title: "Distinct private title",
    description: "Private description",
    submissionId: randomUUID(),
  });
  if (!secret.ok) throw new Error(secret.message);
  await lists.addGame("mario", secret.value.id, 0, 3);
  const publicList = await saved("mario", "public");
  await lists.addGame("mario", publicList.id, 0, 2);
  await lists.addGame("mario", publicList.id, 1, 1);
  const publicLists = await lists.publicCollection("mario");
  expect(publicLists).toEqual([
    {
      id: publicList.id,
      title: "Favorites",
      description: "",
      creator: { username: "mario", image: null },
      createdAt: publicList.createdAt,
      updatedAt: expect.any(Date),
      gameCount: 2,
      games: [
        { gameId: 2, title: "Game 2", slug: "game-2", coverImageId: null },
        { gameId: 1, title: "Game 1", slug: "game-1", coverImageId: null },
      ],
    },
  ]);
  expect(JSON.stringify(publicLists)).not.toMatch(
    /Distinct private|Private description|Game 3|email|feedToken|userId|submissionId|revision|visibility/,
  );
  expect(
    await lists.setVisibility("mario", publicList.id, 2, "private"),
  ).toMatchObject({ ok: true });
  expect(await lists.publicCollection("mario")).toEqual([]);
  expect(await lists.publicDetail("mario", publicList.id)).toBeNull();
  expect(await lists.ownerCollection("mario")).toHaveLength(2);
});

test("valid text limits, duplicate titles and no-op saves preserve identity and revision", async () => {
  const result = await lists.create("mario", {
    title: " x ",
    description: "x".repeat(2000),
    visibility: "public",
    submissionId: randomUUID(),
  });
  if (!result.ok) throw new Error(result.message);
  expect(result.value).toMatchObject({
    title: "x",
    description: "x".repeat(2000),
  });
  expect(
    await lists.edit("mario", result.value.id, 0, {
      title: "x",
      description: "x".repeat(2000),
    }),
  ).toEqual({ ok: true, value: { revision: 0, changed: false } });
  expect(
    await lists.setVisibility("mario", result.value.id, 0, "public"),
  ).toEqual({ ok: true, value: { revision: 0, changed: false } });
  expect(await lists.reorder("mario", result.value.id, 0, [])).toEqual({
    ok: true,
    value: { revision: 0, changed: false },
  });
  expect(await lists.ownerDetail("mario", result.value.id)).toEqual(
    result.value,
  );
  const another = await lists.create("mario", {
    title: "x",
    submissionId: randomUUID(),
  });
  expect(another).toMatchObject({ ok: true });
  expect(
    await lists.edit("mario", result.value.id, 0, { title: "x".repeat(100) }),
  ).toMatchObject({ ok: true, value: { revision: 1 } });
  expect((await lists.ownerCollection("mario"))[0].id).toBe(result.value.id);
});
