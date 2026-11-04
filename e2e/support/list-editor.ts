import { expect, type Page } from "@playwright/test";

export async function closeListPanel(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    await expect
      .poll(
        async () =>
          !(await dialog.isVisible()) ||
          (await dialog
            .getByRole("button", { name: "Close", exact: true })
            .isEnabled()),
      )
      .toBe(true);
    if (await dialog.isVisible()) await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
}

export async function openListPanel(
  page: Page,
  name: "Add games" | "Edit list" | "Visibility and sharing",
) {
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+(?:\?.*)?$/);
  if (await page.getByRole("dialog", { name, exact: true }).isVisible()) return;
  await closeListPanel(page);
  if (name === "Visibility and sharing") {
    await page
      .getByRole("button", { name: "List options", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Sharing", exact: true }).click();
    await expect(
      page.locator('[data-slot="dropdown-menu-content"][data-ending-style]'),
    ).toHaveCount(0);
  } else {
    await page
      .getByRole("button", {
        name: name === "Edit list" ? "Edit details" : name,
        exact: true,
      })
      .click();
  }
  await expect(page.getByRole("dialog", { name, exact: true })).toBeVisible();
}

export async function openListOptions(page: Page) {
  await closeListPanel(page);
  await page.getByRole("button", { name: "List options", exact: true }).click();
}
