import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  owner: "one" as string | null,
  find: vi.fn(),
  move: vi.fn(),
  add: vi.fn(),
  personal: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ signedInUserId: async () => state.owner }));
vi.mock("@/lib/catalog", () => ({
  catalog: { findBySlug: state.find, playNextJournal: state.personal },
}));
vi.mock("@/lib/journal", () => ({
  journal: { move: state.move, addRecommendation: state.add },
}));
vi.mock("./provider", () => ({
  recommendationPage: vi.fn(),
  recommendationSeeds: vi.fn(),
}));

import { loadPlayNext, savePlayNext } from "./actions";

const selection = { id: 1, slug: "celeste", updatedAt: null };
beforeEach(() => {
  vi.clearAllMocks();
  state.owner = "one";
  state.find.mockResolvedValue({ id: 1, slug: "celeste" });
  state.add.mockResolvedValue(true);
  state.move.mockResolvedValue(new Date());
});

test("every personal action rejects missing or switched sessions before reading the Journal or Catalog", async () => {
  for (const owner of [null, "two"]) {
    state.owner = owner;
    expect(await savePlayNext("one", selection, "playing")).toEqual({
      authRequired: true,
    });
    expect(
      (await loadPlayNext("one", { platform: "", genre: "" })).games,
    ).toEqual([]);
  }
  expect(state.find).not.toHaveBeenCalled();
  expect(state.personal).not.toHaveBeenCalled();
  expect(state.add).not.toHaveBeenCalled();
  expect(state.move).not.toHaveBeenCalled();
});

test("server actions validate filters and selected identities rather than trusting client metadata", async () => {
  await expect(
    loadPlayNext("one", { platform: "x".repeat(101), genre: "" }),
  ).rejects.toThrow("valid filters");
  expect(
    await savePlayNext("one", { ...selection, id: -1 }, "playing"),
  ).toHaveProperty("error");
  state.find.mockResolvedValueOnce({ id: 2, slug: "celeste" });
  expect(await savePlayNext("one", selection, "playing")).toHaveProperty(
    "error",
  );
  expect(state.add).not.toHaveBeenCalled();
});

test("explicit starts reuse conditional moves; new recommendations cannot overwrite a saved entry", async () => {
  expect(await savePlayNext("one", selection, "backlog")).toEqual({});
  expect(state.add).toHaveBeenCalledWith("one", 1, "backlog");
  state.add.mockResolvedValueOnce(false);
  expect(await savePlayNext("one", selection, "playing")).toHaveProperty(
    "error",
  );
  const chosen = { ...selection, updatedAt: "2026-01-01T00:00:00.000Z" };
  expect(await savePlayNext("one", chosen, "playing")).toEqual({});
  expect(state.move).toHaveBeenCalledWith(
    "one",
    1,
    { status: "backlog", updatedAt: new Date(chosen.updatedAt) },
    "playing",
  );
  state.move.mockResolvedValueOnce(null);
  expect(await savePlayNext("one", chosen, "playing")).toHaveProperty("error");
});

test("write failures preserve a useful retry error without reporting success", async () => {
  state.add.mockRejectedValueOnce(new Error("offline"));
  expect(await savePlayNext("one", selection, "playing")).toEqual({
    error: expect.stringContaining("Couldn’t confirm"),
  });
});
