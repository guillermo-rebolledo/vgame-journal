import { expect, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./support/sign-up";
import { supportUrl } from "./support/url";

test("deletion preserves the Journal after wrong password, cancellation and expiry", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, uniqueUsername("proof"));
  await page.goto("/settings");
  await expect(page.getByLabel("Type DELETE to confirm")).toHaveCount(0);
  await page.getByLabel("Current password").fill("wrong-password");
  await page
    .getByRole("button", { name: "Confirm password", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not confirm your password",
  );
  expect((await page.request.get("/api/account/export")).ok()).toBe(true);
  await page.getByLabel("Current password").fill("password123");
  await page
    .getByRole("button", { name: "Confirm password", exact: true })
    .click();
  await expect(page.getByLabel("Type DELETE to confirm")).toBeFocused();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect(page.getByLabel("Current password")).toBeFocused();
  await page.reload();
  await expect(page.getByLabel("Type DELETE to confirm")).toHaveCount(0);
  await page.getByLabel("Current password").fill("password123");
  await page
    .getByRole("button", { name: "Confirm password", exact: true })
    .click();
  await expect(page.getByLabel("Type DELETE to confirm")).toBeVisible();
  // Time control at the isolated test store: the browser still submits the real action.
  const expired = await request.post(supportUrl("/query"), {
    data: {
      sql: "update verification set expires_at = '2000-01-01' where value = (select id from \"user\" where email = $1) and identifier like 'account-deletion:%' returning id",
      params: [email],
    },
  });
  expect(expired.ok()).toBe(true);
  expect((await expired.json()).rows).toHaveLength(1);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(page.getByLabel("Current password")).toBeVisible();
  expect((await page.request.get("/api/account/export")).ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Type DELETE to confirm")).toHaveCount(0);
});

test("Settings signs out every independently signed-in device", async ({
  page,
  request,
  browser,
}) => {
  const email = await signUp(page, request, uniqueUsername("all_devices"));
  const other = await browser.newContext();
  try {
    const response = await other.request.post(
      new URL("/api/auth/sign-in/email", page.url()).href,
      {
        data: { email, password: "password123" },
        headers: { origin: new URL(page.url()).origin },
      },
    );
    expect(response.ok()).toBe(true);
    expect(
      (
        await other.request.get(new URL("/api/account/export", page.url()).href)
      ).ok(),
    ).toBe(true);
    await page.goto("/settings");
    await page
      .getByRole("button", { name: "Sign out all devices", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect((await page.request.get("/api/account/export")).status()).toBe(401);
    expect(
      (
        await other.request.get(new URL("/api/account/export", page.url()).href)
      ).status(),
    ).toBe(401);
  } finally {
    await other.close();
  }
});
