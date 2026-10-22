import { expect, test } from "@playwright/test";

test("signed-out visitors see Sign in and can't reach onboarding", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create an account" }),
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
