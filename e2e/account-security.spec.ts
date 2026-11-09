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

for (const theme of ["light", "dark"] as const) {
  test(`account security reflows with reduced motion and enlarged text in ${theme}`, async ({
    page,
    request,
  }, testInfo) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await signUp(page, request, uniqueUsername("security_layout"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate((value) => localStorage.setItem("theme", value), theme);
    await page.goto("/settings");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await expect(page.getByLabel("Current password")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "100%";
    });
    await page.getByLabel("Current password").fill("password123");
    await page
      .getByRole("button", { name: "Confirm password", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Type DELETE to confirm")).toBeFocused();
    const results = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
    const screenshot = testInfo.outputPath(`account-security-${theme}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach(`Account security ${theme}`, {
      path: screenshot,
      contentType: "image/png",
    });
  });
}
