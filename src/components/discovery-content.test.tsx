// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { DiscoveryContent, type DiscoveryResult } from "./discovery-content";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("a failed discovery read explains recovery and retries the current route", async () => {
  render(<DiscoveryContent result={{ error: true }} />);
  expect(screen.getByRole("status").textContent).toContain(
    "Discovery is unavailable",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Retry discovery" }),
  );
  expect(router.refresh).toHaveBeenCalledOnce();
});

test("successful empty discovery stays empty without a retry loop", () => {
  render(<DiscoveryContent result={{ shelves: [] }} />);
  expect(
    screen.getByText("No discovery picks yet—search for a game."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry discovery" })).toBeNull();
  expect(router.refresh).not.toHaveBeenCalled();
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
  const view = render(<DiscoveryContent result={result} />);
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
