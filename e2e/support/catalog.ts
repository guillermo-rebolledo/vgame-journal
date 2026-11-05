import { expect, type Locator, type Page } from "@playwright/test";

export async function openCatalog(page: Page) {
  const input = page.getByRole("combobox", {
    name: "Search games",
    exact: true,
  });
  const visible = (locator: Locator) =>
    locator.filter({ visible: true }).first();
  const back = visible(
    page.getByRole("button", { name: "Back to results", exact: true }),
  );
  const trigger = visible(
    page.getByRole("button", { name: "Search games…", exact: true }),
  );
  // `?q=` and `?search=1` open the catalog after hydration, which can cover the
  // trigger mid-click. Re-check and retry instead of waiting out the test timeout.
  await expect(async () => {
    if (await back.isVisible()) await back.click({ timeout: 2_000 });
    else if (await visible(input).isVisible())
      await input.click({ timeout: 2_000 });
    else await trigger.click({ timeout: 2_000 });
    await expect(input).toBeVisible({ timeout: 2_000 });
  }).toPass();
  return input;
}

/** Select inside a list editor, or follow a standalone result to its game page. */
export async function selectCatalogGame(page: Page, title: string) {
  const input = await openCatalog(page);
  await input.fill(title);
  const embedded = input.locator(
    "xpath=ancestor::*[contains(@class, 'game-search-content')]",
  );
  if (await embedded.count()) {
    await page.getByRole("option", { name: new RegExp(`^${title}`) }).click();
    await expect(
      page.getByRole("button", { name: "Back to results" }),
    ).toBeFocused();
    return page
      .getByRole("dialog")
      .and(page.locator(':not([data-slot="toast"])'));
  }
  await page
    .locator(".game-catalog-result")
    .filter({ hasText: title })
    .first()
    .click();
  await expect(page).toHaveURL(/\/games\//);
  return page.getByRole("group", { name: "Game actions", exact: true });
}

export async function viewCatalogGame(page: Page, title: string) {
  await selectCatalogGame(page, title);
}

export async function closeCatalog(page: Page) {
  const close = page.getByRole("button", { name: "Close search", exact: true });
  if (await close.isVisible()) {
    await close.press("Enter");
    await expect(
      page.getByRole("button", { name: "Close search", exact: true }),
    ).toHaveCount(0);
  }
}
