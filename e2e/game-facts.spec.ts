import { expect, type Page, test } from "@playwright/test";
import { signUp } from "./support/sign-up";

const ageRating = (page: Page) =>
  page.getByRole("button", { name: /^Age rating: / });
const languages = (page: Page) =>
  page.getByRole("button", { name: /^Languages: / });

test("a rated game shows its guest board, with details on hover, focus and Escape", async ({
  page,
}) => {
  await page.goto("/games/hades--1");
  await expect(ageRating(page)).toHaveAccessibleName("Age rating: Teen, ESRB");
  await expect(ageRating(page).getByRole("img")).toHaveAccessibleName("ESRB T");
  await expect(ageRating(page)).toContainText("Teen · ESRB");

  await ageRating(page).hover();
  await expect(ageRating(page)).toHaveAttribute("aria-expanded", "true");
  const rating = page.locator(
    `[id="${await ageRating(page).getAttribute("aria-controls")}"]`,
  );
  await expect(rating).toContainText("ESRB · North America");
  for (const chip of ["Blood", "Fantasy Violence", "Language"])
    await expect(rating.getByText(chip, { exact: true })).toBeVisible();
  await expect(rating.getByText("Other regions")).toBeVisible();
  await expect(rating.getByRole("img")).toHaveCount(7);
  for (const logo of [
    "PEGI 12",
    "CERO C",
    "USK 12",
    "ACB M",
    "GRAC 15+",
    "ClassInd 14",
  ])
    await expect(rating.getByRole("img", { name: logo })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rating).toHaveCount(0);
  await expect(ageRating(page)).toHaveAttribute("aria-expanded", "false");

  await page.mouse.move(0, 0);
  await languages(page).focus();
  await expect(languages(page)).toHaveAccessibleName(
    "Languages: 3, English voices",
  );
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(page.getByText("3 languages · English voices")).toBeVisible();
  const rows = table.getByRole("row");
  await expect(rows.nth(1)).toContainText("English");
  await expect(rows.nth(1).getByRole("img", { name: "Yes" })).toHaveCount(3);
  await expect(rows.nth(2)).toContainText("French");
  await expect(rows.nth(2).getByRole("img", { name: "No" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(table).toHaveCount(0);
});

test("an unrated game without languages says so, with no details", async ({
  page,
}) => {
  await page.goto("/games/dead-cells");
  const facts = page.getByRole("definition");
  await expect(facts.getByText("Not rated yet")).toBeVisible();
  await expect(facts.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(ageRating(page)).toHaveCount(0);
  await expect(languages(page)).toHaveCount(0);
});

test("a game the guest board hasn't rated falls back, and many languages scroll", async ({
  page,
}) => {
  await page.goto("/games/slay-the-spire");
  await expect(ageRating(page)).toHaveAccessibleName(
    "Age rating: Ages 7+, PEGI",
  );
  await expect(languages(page)).toHaveAccessibleName(
    "Languages: 28, English voices",
  );
  await languages(page).hover();
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(29);
  const scroller = table.locator("..");
  expect(
    await scroller.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
});

test("structured data carries the guest rating and languages", async ({
  page,
}) => {
  await page.goto("/games/hades--1");
  const data = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()) ?? "{}",
  );
  expect(data.contentRating).toBe("ESRB T");
  expect(data.inLanguage).toEqual(["English", "French", "Japanese"]);
});

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("a tap opens the details and a tap outside closes them", async ({
    page,
  }) => {
    await page.goto("/games/hades--1");
    await ageRating(page).tap();
    await expect(ageRating(page)).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Other regions")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(page.getByText("Other regions")).toHaveCount(0);
  });
});

test("the headline board follows the signed-in user's Region", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await signUp(page, request, `ratings_${Date.now()}`);
  await page.goto("/games/hades--1");
  await expect(ageRating(page)).toHaveAccessibleName("Age rating: Teen, ESRB");

  await page.goto("/settings");
  await page.getByLabel("Europe", { exact: false }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.goto("/games/hades--1");
  await expect(ageRating(page)).toHaveAccessibleName(
    "Age rating: Ages 12+, PEGI",
  );
  await expect(ageRating(page).getByRole("img")).toHaveAccessibleName(
    "PEGI 12",
  );
});
