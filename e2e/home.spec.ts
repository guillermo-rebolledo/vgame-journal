import { expect, test } from "@playwright/test";

test("landing page defaults to dark, toggles to light, and credits IGDB", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("link", { name: "IGDB" })).toBeVisible();

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
