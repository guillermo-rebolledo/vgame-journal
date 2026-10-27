import { expect, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";

test.describe.configure({ timeout: 120_000 });

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  for (const theme of ["dark", "light"]) {
    test(`${viewport.name} ${theme}: loading, empty and missing-cover collections`, async ({
      page,
      request,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const email = await signUp(page, request, `covers_${Date.now()}`);
      if (theme === "light")
        await page.getByRole("button", { name: "Toggle theme" }).click();
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));

      const delay = async (milliseconds: number) => {
        const response = await request.post(
          "http://127.0.0.1:3101/collection-delay",
          {
            data: { email, milliseconds },
          },
        );
        expect(response.ok()).toBeTruthy();
      };
      const visit = async (
        collection: "Library" | "Wishlist",
        empty: boolean,
      ) => {
        await delay(2500);
        await page.goto(`/${collection.toLowerCase()}`, {
          waitUntil: "commit",
        });
        const loading = page
          .getByRole("status")
          .filter({ hasText: `Loading your ${collection}…` });
        await expect(loading).toBeVisible();
        await expect(
          page
            .getByRole("main")
            .getByRole("button", { name: "Find a game", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByText(`Your ${collection.toLowerCase()} is empty.`),
        ).toHaveCount(0);
        await expect(
          page.getByRole("heading", { level: 1, name: collection }),
        ).toBeVisible();
        expect(
          await loading.evaluate((el) => el.contains(document.activeElement)),
        ).toBe(false);
        await snap(
          page,
          testInfo,
          `${collection.toLowerCase()}-loading-${viewport.name}-${theme}`,
        );
        await expect(loading).toHaveCount(0);
        if (empty)
          await expect(
            page
              .getByRole("main")
              .getByRole("button", { name: "Find a game", exact: true }),
          ).toBeVisible();
        else
          await expect(
            page.getByRole("heading", {
              name: "Moss Cartographer",
              exact: true,
            }),
          ).toBeVisible();
        await delay(0);
      };

      await visit("Library", true);
      await visit("Wishlist", true);
      await page.goto("/");
      await page
        .getByRole("searchbox", { name: "Search games" })
        .fill("Moss Cartographer");
      const result = page
        .getByRole("list", { name: "Search results" })
        .getByRole("link");
      await expect(result).toHaveAccessibleName("Moss Cartographer PC");
      await expect(result.locator('[aria-hidden="true"] svg')).toHaveCount(1);
      await snap(
        page,
        testInfo,
        `search-missing-cover-${viewport.name}-${theme}`,
      );
      await result.click();
      await chooseStatus(page, "wishlist");

      await visit("Library", false);
      const games = page.getByRole("list", { name: "Games" });
      await expect(games.getByText("No cover art")).toBeVisible();
      await expect(games.getByRole("link")).not.toHaveAccessibleName(
        /No cover art/,
      );
      await snap(page, testInfo, `library-grid-${viewport.name}-${theme}`);
      await page.getByRole("button", { name: "List", exact: true }).click();
      await expect(games.locator('[aria-hidden="true"] svg')).toHaveCount(1);
      await snap(page, testInfo, `library-list-${viewport.name}-${theme}`);
      await visit("Wishlist", false);
      await expect(
        page.getByRole("list").locator('[aria-hidden="true"] svg'),
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await snap(page, testInfo, `wishlist-${viewport.name}-${theme}`);
    });
  }
}

test("an unreachable cover keeps the game's title and cover proportions", async ({
  page,
}) => {
  let failCover!: () => void;
  const failed = new Promise<void>((resolve) => {
    failCover = resolve;
  });
  await page.route("https://images.igdb.com/**", async (route) => {
    await failed;
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
  const result = page
    .getByRole("list", { name: "Search results" })
    .getByRole("link");
  const cover = result.locator("img");
  await expect(cover).toBeVisible();
  const before = await cover.boundingBox();
  failCover();
  const fallback = result
    .locator('[aria-hidden="true"]')
    .filter({ has: page.locator("svg.lucide-image-off") });
  await expect(fallback).toBeVisible();
  const after = await fallback.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
  await expect(result).toHaveAccessibleName("Celeste 2018 PC");
});
