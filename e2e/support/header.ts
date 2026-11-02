import { expect, type Page } from "@playwright/test";

/** Opens the header account menu (signed in) or guest menu, then picks an item. */
export async function accountMenuItem(page: Page, name: string) {
  await page
    .locator("header")
    .getByRole("button", { name: /^(Account menu|Menu$)/ })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

export async function chooseTheme(page: Page, theme: "light" | "dark") {
  await accountMenuItem(page, "Theme");
  await page
    .getByRole("menuitemradio", {
      name: theme === "light" ? "Light" : "Dark",
      exact: true,
    })
    .click();
  await expect(page.locator("html")).toHaveClass(new RegExp(theme));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
}
