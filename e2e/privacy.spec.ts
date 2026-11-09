import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { signUp, uniqueUsername } from "./support/sign-up";

test("privacy notice is available before signup and from the footer", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Privacy notice" })
    .click();
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Privacy notice",
  );
  await expect(page.getByRole("main")).toContainText("Community rating");
  await expect(page.getByRole("main")).toContainText("mailbox");
  await page.goto("/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Privacy notice" })
    .click();
  await expect(page).toHaveURL("/privacy");
});

test("Settings explains Calendar secrecy and Journal export limits and links to privacy", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("privacy_settings"));
  await page.goto("/settings");
  const main = page.getByRole("main");
  await expect(
    main.getByText(/not a complete privacy data-access response/),
  ).toBeVisible();
  const calendar = page.getByRole("form", {
    name: "Calendar feed",
    exact: true,
  });
  await expect(calendar).toContainText("without signing in");
  await expect(calendar).toContainText("already downloaded");
  const oldUrl = await page
    .getByRole("textbox", { name: "Calendar feed URL" })
    .inputValue();
  expect((await request.get(oldUrl)).status()).toBe(200);
  await calendar.getByRole("button", { name: "Regenerate URL" }).click();
  await expect(calendar.getByRole("status")).toContainText("Regenerated");
  await expect(
    page.getByRole("textbox", { name: "Calendar feed URL" }),
  ).not.toHaveValue(oldUrl);
  expect((await request.get(oldUrl)).status()).toBe(404);
  await main.getByRole("link", { name: "Privacy notice", exact: true }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(main).toContainText("not a complete response");
});

test("privacy information reflows and remains keyboard accessible in both themes", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await signUp(page, request, uniqueUsername("privacy_layout"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/privacy", "/sign-up", "/settings"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (path === "/settings")
          await expect(
            page.getByRole("textbox", { name: "Calendar feed URL" }),
          ).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          )
          .toBe(true);
        const link =
          path === "/privacy"
            ? page.getByRole("link", { name: "Account settings", exact: true })
            : page
                .getByRole("main")
                .getByRole("link", { name: "Privacy notice", exact: true });
        await link.focus();
        await expect(link).toBeFocused();
        if (width === 390)
          await page.screenshot({
            path: `/tmp/privacy-${theme}-${path.slice(1)}.png`,
            fullPage: true,
          });
      }
    }
  }
  await page.goto("/privacy");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});
