import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";

const path = "/internal/sentry-verification";
const api = "/api/internal/sentry-verification";
const authorization = () =>
  `Bearer ${process.env.E2E_SENTRY_VERIFICATION_TOKEN}`;

test("verification controls and failures require the expiring owner capability", async ({
  page,
  request,
}) => {
  expect((await request.get(path)).status()).toBe(404);
  expect((await request.get(`${path}/render`)).status()).toBe(404);
  expect(
    (
      await request.post(api, {
        headers: { "x-sentry-verification-kind": "route" },
      })
    ).status(),
  ).toBe(404);
  await page.route(`**${path}**`, (route) =>
    route.continue({
      headers: { ...route.request().headers(), authorization: authorization() },
    }),
  );
  const response = await page.goto(path);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByRole("heading", { name: "Monitoring verification" }),
  ).toBeVisible();
  expect(await page.content()).not.toContain(
    process.env.E2E_SENTRY_VERIFICATION_TOKEN,
  );
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page
          .locator("body")
          .evaluate((body) => body.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    const violations = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.violations).toEqual([]);
  }
  const action = page.getByRole("button", { name: "Test server action" });
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText(
    "Server action failure returned safely.",
  );
  const browserError = page.waitForEvent("pageerror");
  await page.getByRole("button", { name: "Test browser handler" }).click();
  expect((await browserError).message).toContain(
    "Sentry verification: browser handler",
  );
  await expect(action).toBeVisible();
  await page.getByRole("button", { name: "Test browser render" }).click();
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry page" })).toBeVisible();
  await page.goto(`${path}/render`);
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
});

test("authorized server probes have fixed, bounded outcomes", async ({
  request,
}) => {
  const probe = (kind: string) =>
    request.post(api, {
      headers: {
        authorization: authorization(),
        "x-sentry-verification-kind": kind,
      },
    });
  expect((await probe("route")).status()).toBe(500);
  expect(await (await probe("caught")).json()).toEqual({
    result: "Caught fallback preserved",
  });
  expect(await (await probe("independent")).json()).toEqual({
    result: "Two independent failures observed",
  });
  expect((await probe("arbitrary")).status()).toBe(400);
});
