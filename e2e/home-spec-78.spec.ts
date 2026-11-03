import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";

for (const theme of ["dark", "light"] as const) {
  test(`spec 78: guest and returning Home remain readable in ${theme}`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await chooseTheme(page, theme);
    const search = page.getByRole("search", {
      name: "Search games",
      exact: true,
    });
    await expect(
      search.getByLabel("Search games", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Track",
    );
    const signup = page.getByRole("link", {
      name: "Sign up to start a Journal",
    });
    const example = page.getByRole("figure", { name: "Example Journal" });
    await expect(example).toContainText("Backlog");
    await expect(example).toContainText("Wishlist");
    expect(
      await signup.evaluate((node) => {
        const figure = document.querySelector(
          'figure[aria-label="Example Journal"]',
        );
        return (
          !!figure &&
          !!(
            node.compareDocumentPosition(figure) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
        );
      }),
    ).toBe(true);
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [768, 1024],
      [1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      for (const fontSize of [16, 32]) {
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}px`;
        }, fontSize);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "16px";
      });
      if (width === 390 || width === 1440)
        await snap(page, testInfo, `guest-${theme}-${width}`, true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await signUp(page, request, `home78_${theme}_${Date.now()}`);
    await expect(
      page.getByRole("link", { name: "All saved games (0)", exact: true }),
    ).toBeVisible();
    await snap(page, testInfo, `empty-${theme}-390`, true);
    await page.goto("/games/celeste");
    await chooseStatus(page, "playing");
    await page.goto("/");
    await expect(
      page
        .getByRole("region", { name: "Playing", exact: true })
        .getByRole("link", { name: /Celeste/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Recently added", exact: true })
        .getByRole("link", { name: /Celeste/ }),
    ).toBeVisible();
    await snap(page, testInfo, `one-entry-${theme}-390`, true);
    await page.goto("/games/silksong");
    await chooseStatus(page, "wishlist");
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "All saved games (2)", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Wishlist (1)", exact: true }),
    ).toBeVisible();
    for (const [width, height] of [
      [390, 844],
      [1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await snap(page, testInfo, `returning-${theme}-${width}`, true);
    }
  });
}
