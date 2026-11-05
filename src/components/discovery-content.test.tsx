// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { saveHomeStatus } from "@/app/home-actions";
import { DiscoveryContent, type DiscoveryResult } from "./discovery-content";
import { HomeCoverTransitions } from "./home-cover-link";
import { HomeCollections, HomeJournalProvider } from "./home-journal";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/home-actions", () => ({
  saveHomeStatus: vi.fn(),
  readHomeJournal: vi.fn(),
  homeIntentGame: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("a failed discovery read explains recovery and retries the current route", async () => {
  renderDiscovery(<DiscoveryContent result={{ error: true }} />);
  expect(screen.getByRole("status").textContent).toContain(
    "Discovery is unavailable",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Retry discovery" }),
  );
  expect(router.refresh).toHaveBeenCalledOnce();
});

test("successful empty discovery stays empty without a retry loop", () => {
  renderDiscovery(<DiscoveryContent result={{ shelves: [] }} />);
  expect(
    screen.getByText("No discovery picks yet—search for a game."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry discovery" })).toBeNull();
  expect(router.refresh).not.toHaveBeenCalled();
});

test("discovery separates release metadata from freshness and reveals platforms outside game links", async () => {
  renderDiscovery(
    <DiscoveryContent
      result={{
        shelves: [
          {
            key: "popular",
            refreshedAt: new Date("2026-11-03T12:00:00Z"),
            games: [
              {
                id: 7,
                title: "Old classic",
                slug: "old-classic",
                coverImageId: null,
                year: 1998,
                platforms: ["PC", "Super Nintendo Entertainment System"],
              },
              {
                id: 8,
                title: "Undocumented classic",
                slug: "undocumented-classic",
                coverImageId: null,
                year: null,
                platforms: [],
              },
            ],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("1998")).toBeTruthy();
  expect(screen.getByText("Nov 3, 2026").getAttribute("datetime")).toBe(
    "2026-11-03T12:00:00.000Z",
  );
  expect(screen.getByText("Year unavailable")).toBeTruthy();
  expect(screen.getByText("Platform availability unknown")).toBeTruthy();
  const disclosure = screen.getByLabelText(/More platforms for Old classic$/);
  expect(disclosure.closest("a")).toBeNull();
  await userEvent.click(disclosure);
  expect(
    screen.getByRole("list", { name: "Additional platforms for Old classic" })
      .textContent,
  ).toBe("Super Nintendo Entertainment System");
  expect(screen.getByRole("link", { name: "Old classic" })).toBeTruthy();
  expect(screen.queryByText(/TBA|upcoming|announcement/i)).toBeNull();
});

test("a later read failure keeps successful picks and their honest Updated time", async () => {
  const result: DiscoveryResult = {
    shelves: [
      {
        key: "popular",
        games: [
          {
            id: 1,
            title: "Celeste",
            slug: "celeste",
            coverImageId: null,
            year: 2018,
            platforms: ["PC"],
          },
        ],
        refreshedAt: new Date("2026-10-01T12:00:00Z"),
      },
    ],
  };
  const view = renderDiscovery(<DiscoveryContent result={result} />);
  expect(
    screen.getByRole("link", { name: "Celeste" }).getAttribute("href"),
  ).toBe("/games/celeste");
  view.rerender(<DiscoveryContent result={{ error: true }} />);
  expect(screen.getAllByRole("link", { name: "Celeste" })).toHaveLength(1);
  expect(screen.getByText("Oct 1, 2026").getAttribute("datetime")).toBe(
    "2026-10-01T12:00:00.000Z",
  );
  expect(screen.getByRole("status").textContent).toContain(
    "Showing the last available picks",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Retry discovery" }),
  );
  expect(router.refresh).toHaveBeenCalledOnce();
  view.rerender(<DiscoveryContent result={result} />);
  expect(screen.queryByRole("button", { name: "Retry discovery" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Celeste" })).toHaveLength(1);
  view.rerender(<DiscoveryContent result={{ shelves: [] }} />);
  expect(screen.queryByRole("link", { name: "Celeste" })).toBeNull();
  expect(
    screen.getByText("No discovery picks yet—search for a game."),
  ).toBeTruthy();
});

test("discovery saves update shared Status, counts and the resolved Wishlist preview", async () => {
  const game = {
    gameId: 7,
    title: "Old classic",
    slug: "old-classic",
    coverImageId: null,
    status: "wishlist" as const,
    addedAt: new Date("2026-01-01"),
    release: {
      date: new Date("2099-12-10"),
      precision: "day" as const,
      label: "Dec 10, 2099",
    },
  };
  vi.mocked(saveHomeStatus).mockResolvedValue({
    snapshot: { owner: "player", entries: [game] },
  });
  renderDiscovery(
    <HomeJournalProvider
      owner="player"
      initial={Promise.resolve({ owner: "player", entries: [] })}
    >
      <HomeCollections />
      <DiscoveryContent
        result={{
          shelves: [
            {
              key: "popular",
              refreshedAt: new Date("2026-11-03"),
              games: [
                {
                  id: 7,
                  title: game.title,
                  slug: game.slug,
                  coverImageId: null,
                  year: 1998,
                  platforms: ["PC"],
                },
              ],
            },
          ],
        }}
      />
    </HomeJournalProvider>,
  );
  await screen.findByRole("link", { name: "All saved games (0)" });
  await userEvent.click(
    screen.getByRole("button", { name: "Add to wishlist for Old classic" }),
  );
  await screen.findByRole("link", { name: "Wishlist (1)" });
  expect(
    screen.getByRole("region", { name: "Recently trending" }).textContent,
  ).toContain("Wishlisted");
  expect(
    screen.getByRole("region", { name: "Wishlist release preview" })
      .textContent,
  ).toContain("Dec 10, 2099");
  expect(
    within(
      screen.getByRole("region", { name: "Wishlist release preview" }),
    ).getByRole("button", { name: /Change status for Old classic$/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "Recently added" }).textContent,
  ).toContain("Wishlisted");
});

function renderDiscovery(ui: Parameters<typeof render>[0]) {
  return render(ui, { wrapper: HomeCoverTransitions });
}
