import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { closeListPanel, openListPanel } from "./support/list-editor";
import { signUp, uniqueUsername } from "./support/sign-up";
import { snap } from "./support/snap";

test("adding games stays at the top and the search drawer supports repeated additions", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, uniqueUsername("list_focused"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Weekend games");
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("A long description.\n".repeat(100));
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add games", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("details").getByText("A long description.", { exact: false }),
  ).not.toBeVisible();
  await page.getByText("About this list", { exact: true }).click();
  await expect(
    page.locator("details").getByText("A long description.", { exact: false }),
  ).toBeVisible();
  await page.getByText("About this list", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh saved list", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add games", exact: true })
    .press("Enter");
  const search = page.getByRole("searchbox", {
    name: "Search games",
    exact: true,
  });
  await expect(search).toBeFocused();
  for (const title of ["Celeste", "Hades"]) {
    await search.fill(title);
    await page
      .getByRole("button", { name: `Add ${title} to list`, exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `${title} already in list`,
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("dialog", { name: "Add games", exact: true }),
    ).toBeVisible();
  }
  await closeListPanel(page);
  await expect(
    page.getByRole("button", { name: "Add games", exact: true }),
  ).toBeFocused();
  await expect(
    page
      .getByRole("list", { name: "List games", exact: true })
      .getByRole("link"),
  ).toHaveText(["Celeste", "Hades"]);
  await openListPanel(page, "Edit list");
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Draft title");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Edit details", exact: true }),
  ).toBeFocused();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveValue("Draft title");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Draft title", exact: true }),
  ).toBeVisible();
  await snap(page, testInfo, "populated-list-editor", true);
});

test("list drawers and the game-page picker reflow with narrow screens and enlarged text", async ({
  page,
  request,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, request, uniqueUsername("list_reflow"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Weekend games");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add games", exact: true }),
  ).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await expect(
        page.getByRole("button", { name: "Add games", exact: true }),
      ).toBeInViewport();
      if (width === 320 || width === 1440)
        await snap(page, testInfo, `editor-${theme}-${width}`, true);
      for (const panel of [
        "Add games",
        "Edit list",
        "Visibility and sharing",
      ] as const) {
        await openListPanel(page, panel);
        const dialog = page.getByRole("dialog", { name: panel, exact: true });
        await expect
          .poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth))
          .toBe(true);
        if (width === 320)
          await snap(page, testInfo, `${panel}-${theme}-${width}`);
        await closeListPanel(page);
      }
    }
  }
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/games/celeste?addToList=1");
  const picker = page.getByRole("region", {
    name: "Add Celeste to a list",
    exact: true,
  });
  await expect(
    picker.getByRole("button", {
      name: "Add Celeste to Weekend games",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await picker
    .getByText("Create a new list for Celeste", { exact: true })
    .click();
  await expect(
    picker.getByRole("textbox", { name: "List title", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect
    .poll(() => picker.evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(500);
  await snap(page, testInfo, "picker-200-percent-text", true);
});
