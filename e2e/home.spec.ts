import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";

test("landing page defaults to dark, toggles to light, and credits IGDB", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("link", { name: "IGDB" })).toBeVisible();

  await chooseTheme(page, "light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
