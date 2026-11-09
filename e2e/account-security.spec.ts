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

async function googleOnly(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
) {
  const email = await signUp(page, request, uniqueUsername("google_email"));
  const response = await request.post(supportUrl("/query"), {
    data: {
      sql: "update account set provider_id = 'google', password = null where user_id = (select id from \"user\" where email = $1)",
      params: [email],
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/settings");
  await expect(page.getByLabel("Current password")).toHaveCount(0);
  return email;
}

async function deletionCode(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  email: string,
) {
  await page.getByRole("button", { name: "Send confirmation code" }).click();
  await expect(page.getByLabel("Email confirmation code")).toBeVisible();
  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const mail = mailbox.findLast(
    (mail: { to: string; subject: string }) =>
      mail.to === email && mail.subject.includes("deletion"),
  );
  expect(mail.text).not.toMatch(/https?:/);
  const code = mail.text.match(/\b\d{8}\b/)?.[0];
  expect(code).toHaveLength(8);
  expect((await page.request.get("/api/account/export")).ok()).toBe(true);
  return code as string;
}

test("Google-only account uses the local email API and keyboard confirmation before deletion", async ({
  page,
  request,
}, testInfo) => {
  const email = await googleOnly(page, request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const code = await deletionCode(page, request, email);
  await expect(page.getByLabel("Email confirmation code")).toBeFocused();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "100%";
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath(`email-confirmation-${theme}.png`),
      fullPage: true,
    });
  }
  await page.getByLabel("Email confirmation code").fill(code);
  await page.getByRole("button", { name: "Confirm email code" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Type DELETE to confirm")).toBeFocused();
  expect((await page.request.get("/api/account/export")).ok()).toBe(true);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
  expect((await page.request.get("/api/account/export")).status()).toBe(401);
});

test("Google-only email cancellation, wrong codes and expiry preserve the account", async ({
  page,
  request,
}) => {
  const email = await googleOnly(page, request);
  const cancelled = await deletionCode(page, request, email);
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect(
    page.getByRole("button", { name: "Send confirmation code" }),
  ).toBeFocused();
  await deletionCode(page, request, email);
  await page.getByLabel("Email confirmation code").fill(cancelled);
  await page.getByRole("button", { name: "Confirm email code" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not confirm the code",
  );
  await expect(page.getByLabel("Type DELETE to confirm")).toHaveCount(0);
  const response = await request.post(supportUrl("/query"), {
    data: {
      sql: "update verification set expires_at = '2000-01-01' where identifier like 'account-deletion-code:%' and value::jsonb->>'userId' = (select id from \"user\" where email = $1)",
      params: [email],
    },
  });
  expect(response.ok()).toBe(true);
  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const code = mailbox
    .findLast(
      (mail: { to: string; subject: string }) =>
        mail.to === email && mail.subject.includes("deletion"),
    )
    .text.match(/\b\d{8}\b/)[0];
  await page.getByLabel("Email confirmation code").fill(code);
  await page.getByRole("button", { name: "Confirm email code" }).click();
  await expect(page.getByLabel("Type DELETE to confirm")).toHaveCount(0);
  expect((await page.request.get("/api/account/export")).ok()).toBe(true);
});

test("Google-only failed email delivery permits a safe retry without identity confirmation", async ({
  page,
  request,
}) => {
  const email = await googleOnly(page, request);
  await request.post(supportUrl("/mail-failure"), {
    data: { email, fail: true },
  });
  await page.getByRole("button", { name: "Send confirmation code" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not send confirmation",
  );
  await expect(page.getByLabel("Type DELETE to confirm")).toHaveCount(0);
  await request.post(supportUrl("/mail-failure"), {
    data: { email, fail: false },
  });
  const code = await deletionCode(page, request, email);
  await page.getByLabel("Email confirmation code").fill(code);
  await page.getByRole("button", { name: "Confirm email code" }).click();
  await expect(page.getByLabel("Type DELETE to confirm")).toBeVisible();
  expect((await page.request.get("/api/account/export")).ok()).toBe(true);
});
