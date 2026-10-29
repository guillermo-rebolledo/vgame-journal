import { expect, test } from "@playwright/test";

test("tag shelves switch instantly, support keyboard navigation and open recommended games", async ({
  page,
}) => {
  await page.goto("/games/hades--1");
  const section = page.getByRole("region", {
    name: "More like Hades",
    exact: true,
  });
  await expect(section).toBeVisible();
  const pills = section.getByRole("button");
  await expect(pills.first()).toHaveText("Roguelike");
  await expect(pills.first()).toHaveAttribute("aria-pressed", "true");
  await expect(section.getByRole("link")).toHaveCount(6);
  await expect(section.getByRole("link").first()).toHaveText("Dead Cells");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "fetch") requests.push(request.url());
  });
  await section
    .getByRole("button", { name: "Dungeon crawler", exact: true })
    .click();
  await expect(pills.first()).toHaveAttribute("aria-pressed", "false");
  await expect(
    section.getByRole("button", { name: "Dungeon crawler", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(section.locator('[aria-live="polite"]')).toHaveText(
    "Most rated games tagged Dungeon crawler",
  );
  await expect(section.getByRole("link").first()).toHaveText("Diablo II");
  expect(requests).toEqual([]);
  await pills.first().focus();
  for (let i = 1; i < (await pills.count()); i++) {
    await page.keyboard.press("Tab");
    await expect(pills.nth(i)).toBeFocused();
  }
  await page.keyboard.press("Tab");
  await expect(section.getByRole("link").first()).toBeFocused();
  expect(
    await section
      .getByRole("link")
      .first()
      .evaluate((n) => n.matches(":focus-visible")),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/games\/diablo-ii$/);
  await expect(
    page.getByRole("heading", { name: "Diablo II", exact: true }),
  ).toBeVisible();
});

test("phone and desktop grids fit, pills scroll on one line, and reduced motion skips cover entries", async ({
  page,
}) => {
  await page.goto("/games/hades--1");
  const section = page.getByRole("region", {
    name: "More like Hades",
    exact: true,
  });
  await expect(section.getByRole("link")).toHaveCount(6);
  const columns = () =>
    section
      .locator("ul")
      .evaluate(
        (n) => getComputedStyle(n).gridTemplateColumns.split(" ").length,
      );
  expect(await columns()).toBe(6);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await columns()).toBe(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const positions = await section
    .getByRole("button")
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
  expect(new Set(positions).size).toBe(1);
  expect(
    await section
      .locator("fieldset")
      .evaluate((n) => n.scrollWidth > n.clientWidth),
  ).toBe(true);
  for (const pill of await section.getByRole("button").all())
    expect(
      await pill.evaluate((n) => n.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await section
    .getByRole("button", { name: "Dungeon crawler", exact: true })
    .click();
  expect(
    await section
      .locator("li")
      .first()
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
});

test("games without usable tags omit the section", async ({ page }) => {
  await page.goto("/games/silksong");
  await expect(
    page.getByRole("heading", { name: "Silksong", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /^More like/ })).toHaveCount(
    0,
  );
});
