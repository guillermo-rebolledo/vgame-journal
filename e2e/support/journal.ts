import { expect, type Page } from "@playwright/test";

export async function chooseStatus(page: Page, value: string) {
  await page
    .getByRole("button", {
      name: /(?:Add to Journal|Change Journal status) for /,
      exact: true,
    })
    .click();
  await page.getByRole("menuitemradio", { name: value, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /(?:Add to Journal|Change Journal status) for /,
      exact: true,
    }),
  ).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("button", {
      name: /(?:Add to Journal|Change Journal status) for /,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: value, exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
}
