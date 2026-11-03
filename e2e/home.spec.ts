import { expect, test } from "@playwright/test";
import { chooseAccountMenuItem, chooseTheme } from "./support/header";

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

for (const colorScheme of ["light", "dark"] as const) {
  test(`System tracks ${colorScheme} OS appearance, changes live, and survives reload`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await chooseTheme(page, "system");
    await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
    const before = await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor);
    const opposite = colorScheme === "light" ? "dark" : "light";
    await page.emulateMedia({ colorScheme: opposite });
    await expect(page.locator("html")).toHaveClass(new RegExp(opposite));
    await expect(page.locator("body")).not.toHaveCSS(
      "background-color",
      before,
    );
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(opposite));
    await chooseAccountMenuItem(page, "Theme");
    await expect(
      page.getByRole("menuitemradio", { name: "System", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    expect(errors).toEqual([]);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`explicit ${theme} stays stable when the OS changes`, async ({
    page,
  }) => {
    await page.goto("/");
    await chooseTheme(page, theme);
    const color = await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await expect(page.locator("body")).toHaveCSS("background-color", color);
    }
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
  });
}
