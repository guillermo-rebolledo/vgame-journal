import { expect, test } from "@playwright/test";
import { selectCatalogGame } from "./support/catalog";
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
  const search = page.getByRole("combobox", {
    name: "Search games",
    exact: true,
  });
  await expect(search).toBeFocused();
  for (const title of ["Celeste", "Hades"]) {
    await selectCatalogGame(page, title);
    await expect(
      page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: `Add to list: ${title}`, exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `Already in list: ${title}`,
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("dialog", { name: "Add games", exact: true }),
    ).toBeVisible();
    if (title === "Celeste") {
      await page.getByRole("button", { name: "Back to results" }).click();
      await expect(search).toHaveValue(title);
    }
  }
  expect(
    (await (await page.request.get("/api/account/export")).json()).entries,
  ).toEqual([]);
  await closeListPanel(page);
  await expect(
    page.getByRole("button", { name: "Add games", exact: true }),
  ).toBeFocused();
  await openListPanel(page, "Add games");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Hades");
  await expect(page.getByRole("option", { name: /^Hades/ })).toBeVisible();
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(1);
  await closeListPanel(page);
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
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(0);
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
  const picker = page.getByRole("dialog", {
    name: "Add to list",
    exact: true,
  });
  await expect(
    picker.getByRole("button", {
      name: "Add here: Celeste to Weekend games",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await picker.getByText("Create a new list", { exact: true }).click();
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

test("embedded additions retain failure, pending-close and stale-version recovery in one editor", async ({
  page,
  request,
  context,
}) => {
  await signUp(page, request, uniqueUsername("list_contracts"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Command contracts");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Add games");
  const editor = await selectCatalogGame(page, "Celeste");
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(1);
  let failed = false;
  await page.route("**/*", async (route) => {
    if (!failed && route.request().headers()["next-action"]) {
      failed = true;
      await route.abort("failed");
    } else await route.continue();
  });
  await editor
    .getByRole("button", { name: "Add to list: Celeste", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText(
    "Couldn’t confirm the save",
  );
  await expect(
    editor.getByRole("button", { name: "Add to list: Celeste", exact: true }),
  ).toBeDisabled();
  await page.unrouteAll({ behavior: "wait" });
  await editor
    .getByRole("button", { name: "Refresh saved list", exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Add to list: Celeste", exact: true }),
  ).toBeEnabled();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let pending = false;
  await page.route("**/*", async (route) => {
    if (!pending && route.request().headers()["next-action"]) {
      pending = true;
      await held;
    }
    await route.continue();
  });
  try {
    await editor
      .getByRole("button", { name: "Add to list: Celeste", exact: true })
      .click();
    await expect(
      editor.getByRole("button", { name: "Close", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(editor).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Add to list: Celeste", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    editor.getByRole("button", {
      name: "Already in list: Celeste",
      exact: true,
    }),
  ).toBeDisabled();
  await page.unrouteAll({ behavior: "wait" });
  await page.keyboard.press("Control+k");
  const input = editor.getByRole("combobox", {
    name: "Search games",
    exact: true,
  });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Celeste");
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(1);
  const other = await context.newPage();
  try {
    await other.goto(page.url());
    await openListPanel(other, "Edit list");
    await other
      .getByRole("textbox", { name: "List title", exact: true })
      .fill("Changed elsewhere");
    await other
      .getByRole("button", { name: "Save details", exact: true })
      .click();
    await expect(
      other.getByRole("dialog").and(other.locator(':not([data-slot="toast"])')),
    ).toHaveCount(0);
    await selectCatalogGame(page, "Hades");
    await editor
      .getByRole("button", { name: "Add to list: Hades", exact: true })
      .click();
    await expect(editor.getByRole("alert")).toContainText("This list changed");
    await editor
      .getByRole("button", { name: "Refresh saved list", exact: true })
      .click();
    await expect(
      editor.getByRole("button", { name: "Add to list: Hades", exact: true }),
    ).toBeEnabled();
    await editor
      .getByRole("button", { name: "Add to list: Hades", exact: true })
      .click();
    await expect(
      editor.getByRole("button", {
        name: "Already in list: Hades",
        exact: true,
      }),
    ).toBeDisabled();
  } finally {
    await other.close();
  }
  await closeListPanel(page);
  await openListPanel(page, "Edit list");
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(1);
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toHaveCount(0);
  await closeListPanel(page);
  await expect(
    page
      .getByRole("list", { name: "List games", exact: true })
      .getByRole("link"),
  ).toHaveText(["Celeste", "Hades"]);
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.entries).toEqual([]);
  expect(exported.playthroughs).toEqual([]);
});
