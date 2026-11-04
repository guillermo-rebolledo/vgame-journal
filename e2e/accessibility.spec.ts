import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";

async function scan(page: Page, testInfo: TestInfo, name: string) {
  await expect(
    page
      .getByRole("main")
      .getByText(
        /^(Loading .*|Opening your Journal|Checking Journal status)…$/,
      ),
  ).toHaveCount(0);
  // Metadata can stream after a save refresh has restored the page controls.
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  await testInfo.attach(name, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  const blocking = results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
  expect
    .soft(blocking, `${name}: serious or critical WCAG violations`)
    .toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility in ${theme} theme`, () => {
    test.setTimeout(120_000);

    test("lists and list creation drawer", async ({
      page,
      request,
    }, testInfo) => {
      await signUp(page, request, `axe_lists_${theme}_${Date.now()}`);
      await chooseTheme(page, theme);
      await page.goto("/lists");
      await expect(
        page
          .getByText("No lists yet", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await scan(page, testInfo, "empty-lists");
      await page
        .getByRole("button", { name: "Create a list", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Create a list", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "list-creation-drawer");
      await page
        .getByRole("textbox", { name: "List title", exact: true })
        .fill("   ");
      await page
        .getByRole("button", { name: "Create list", exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: "List title", exact: true }),
      ).toHaveAttribute("aria-invalid", "true");
      await scan(page, testInfo, "list-title-validation");
      await page
        .getByRole("textbox", { name: "List title", exact: true })
        .fill("Weekend games");
      await page
        .getByRole("button", { name: "Create list", exact: true })
        .click();
      await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
      await page.goto("/lists");
      await expect(
        page.getByRole("link", { name: "Weekend games", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "populated-lists");
    });

    test("guest pages and search results", async ({ page }, testInfo) => {
      await page.goto("/");
      await chooseTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await scan(page, testInfo, "guest-home");

      await page.getByRole("searchbox").fill("Celeste");
      await expect(
        page.getByRole("link", { name: "Celeste", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "search-results");

      for (const path of [
        "/games/celeste",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await scan(page, testInfo, path);
      }
    });

    test("personal pages, journal menu, and playthrough editor", async ({
      page,
      request,
    }, testInfo) => {
      const username = `axe_${theme}_${Date.now()}`;
      await signUp(page, request, username);
      await chooseTheme(page, theme);
      await page.goto("/games/celeste");
      await expect(
        page.getByRole("button", { name: "Add playthrough", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "unsaved-game");
      await chooseStatus(page, "playing");
      await page
        .getByRole("button", { name: /Change Journal status for/ })
        .click();
      await expect(page.getByRole("menu")).toBeVisible();
      await scan(page, testInfo, "journal-menu");
      await page.keyboard.press("Escape");

      const add = page.getByRole("button", {
        name: "Add playthrough",
        exact: true,
      });
      await add.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan(page, testInfo, "playthrough-editor");
      await page.getByLabel("Started", { exact: true }).fill("2026-02-02");
      await page.getByLabel("Finished (optional)").fill("2026-01-01");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
      await scan(page, testInfo, "playthrough-validation");
      await page.getByLabel("Finished (optional)").fill("");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(add).toBeFocused();
      await scan(page, testInfo, "saved-playthrough");

      await page.goto("/games/hades--1");
      await chooseStatus(page, "wishlist");
      for (const path of [
        "/",
        "/library",
        "/wishlist",
        "/stats",
        "/settings",
        `/u/${username}`,
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await scan(page, testInfo, path);
      }
    });
  });
}
