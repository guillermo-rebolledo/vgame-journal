import { expect, type Page } from "@playwright/test";

/** Opens the header account menu (signed in) or guest menu, then picks an item. */
export async function chooseAccountMenuItem(page: Page, name: string) {
  await page
    .locator("header")
    .getByRole("button", { name: /^(Account menu|Menu$)/ })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

export async function chooseTheme(
  page: Page,
  theme: "light" | "dark" | "system",
) {
  await chooseAccountMenuItem(page, "Theme");
  await page
    .getByRole("menuitemradio", {
      name: { light: "Light", dark: "Dark", system: "System" }[theme],
      exact: true,
    })
    .click();
  if (theme !== "system")
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
  // Escape closes the Theme sub-menu first, then the account menu.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
}
