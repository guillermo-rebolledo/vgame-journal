import { expect, type Page } from "@playwright/test";

export async function openCatalog(page: Page) {
  const input = page.getByRole("combobox", {
    name: "Search games",
    exact: true,
  });
  await input
    .or(page.getByRole("button", { name: "Back to results", exact: true }))
    .or(page.getByRole("button", { name: "Search games…", exact: true }))
    .filter({ visible: true })
    .first()
    .click();
  await expect(input).toBeVisible();
  return input;
}

export async function selectCatalogGame(page: Page, title: string) {
  const input = await openCatalog(page);
  await input.fill(title);
  await page.getByRole("option", { name: new RegExp(`^${title}`) }).click();
  await expect(
    page.getByRole("button", { name: "Back to results" }),
  ).toBeFocused();
  return page
    .getByRole("dialog")
    .and(page.locator(':not([data-slot="toast"])'));
}

export async function viewCatalogGame(page: Page, title: string) {
  const actions = await selectCatalogGame(page, title);
  await actions
    .getByRole("link", { name: `View game: ${title}`, exact: true })
    .click();
}

export async function closeCatalog(page: Page) {
  const close = page.getByRole("button", { name: "Close search", exact: true });
  if (await close.isVisible()) {
    await close.click();
    await expect(
      page.getByRole("button", { name: "Close search", exact: true }),
    ).toHaveCount(0);
  }
}
