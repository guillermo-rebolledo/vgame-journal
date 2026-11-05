import { expect, test } from "@playwright/test";
import { openCatalog } from "./support/catalog";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { signUp, uniqueUsername } from "./support/sign-up";
import { snap } from "./support/snap";
import { supportUrl } from "./support/url";

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
      const email = await signUp(page, request, uniqueUsername(`covers`));
      if (theme === "light") await chooseTheme(page, "light");
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));

      const delay = async (milliseconds: number) => {
        const response = await request.post(supportUrl("/collection-delay"), {
          data: { email, milliseconds },
        });
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
      await (await openCatalog(page)).fill("Moss Cartographer");
      const result = page.locator(".game-catalog-results").getByRole("link");
      await expect(result).toHaveAccessibleName(/Moss Cartographer/);
      await expect(result.getByText("Year unavailable")).toBeVisible();
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
  await (await openCatalog(page)).fill("Celeste");
  const result = page.locator(".game-catalog-results").getByRole("link");
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
  await expect(result).toHaveAccessibleName(/Celeste/);
  const row = page.locator(".game-catalog-results").getByRole("link");
  await expect(row.getByText("2018", { exact: true })).toBeVisible();
  await expect(row.getByText(/PC/)).toBeVisible();
});

for (const signedIn of [false, true]) {
  for (const theme of ["dark", "light"]) {
    test(`R08: ${signedIn ? "owner" : "guest"} phone ${theme} compact cover falls back and recovers`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      if (signedIn) await signUp(page, request, uniqueUsername(`hero`));
      let failedRequests = 0;
      await page.route("https://images.igdb.com/**", (route) => {
        if (route.request().url().includes("cob9kr")) {
          failedRequests++;
          return route.abort();
        }
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="264" height="374"><rect width="264" height="374" fill="teal"/></svg>',
        });
      });
      await page.goto("/games/hades--1");
      if (theme === "light") await chooseTheme(page, "light");
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      const article = page.getByRole("article");
      const fallback = article.getByText("No cover art", { exact: true });
      await expect(fallback).toBeVisible();
      expect(failedRequests).toBeGreaterThan(0);
      await expect(article.locator('img[src*="/cob9kr.jpg"]')).toHaveCount(0);
      const box = await fallback.locator("..").boundingBox();
      expect(box?.width).toBe(80);
      expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(264 / 374, 2);
      await expect(
        page.getByRole("heading", { level: 1, name: "Hades" }),
      ).toBeVisible();
      await expect(
        page.getByRole(signedIn ? "button" : "link", {
          name: "Add playthrough",
          exact: true,
        }),
      ).toBeVisible();

      // Client navigation reuses the detail image components with different sources.
      await article.getByRole("link", { name: /Dead Cells/ }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Dead Cells" }),
      ).toBeVisible();
      const images = article.locator('img[src*="/co7jfv.jpg"]');
      await expect(images).toHaveCount(1);
      await expect
        .poll(() =>
          images.evaluateAll((nodes) =>
            nodes.every(
              (node) =>
                node instanceof HTMLImageElement &&
                node.complete &&
                node.naturalWidth > 0,
            ),
          ),
        )
        .toBe(true);
      const recovered = await article
        .locator('img[src*="/co7jfv.jpg"][width="264"]')
        .boundingBox();
      expect(recovered?.width).toBe(80);
      expect((recovered?.width ?? 0) / (recovered?.height ?? 1)).toBeCloseTo(
        264 / 374,
        2,
      );
      // Missing metadata uses the same unavailable-cover presentation.
      await page.goto("/games/moss-cartographer");
      await expect(fallback).toBeVisible();
      await expect(article.locator("img")).toHaveCount(0);
    });
  }
}
