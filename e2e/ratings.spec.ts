import { expect, type Page, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { seedRatedGame } from "./support/ratings";
import { signUp, uniqueUsername } from "./support/sign-up";

test.describe.configure({ timeout: 90_000 });

const communityRating = (page: Page) =>
  page
    .locator('dl[aria-label="Game facts"]')
    .filter({ visible: true })
    .locator("div")
    .filter({ has: page.locator("dt", { hasText: /^Community rating$/ }) });

async function schemaRating(page: Page) {
  const data = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()) ?? "{}",
  );
  return data.aggregateRating;
}

test("rating a Played game updates the Community rating at once, and clearing removes it", async ({
  page,
  request,
}) => {
  const { slug, title } = await seedRatedGame(request);
  await signUp(page, request, uniqueUsername("rate"));
  await page.goto(`/games/${slug}`);
  await expect(communityRating(page)).toContainText("No Ratings yet");
  // No Rating control until the game is Played or Playing.
  await expect(page.getByRole("group", { name: "Your rating" })).toHaveCount(0);

  await chooseStatus(page, "played");
  const rating = page.getByRole("group", { name: "Your rating" });
  await rating.getByRole("radio", { name: "4 stars out of 5" }).click();
  await expect(page.locator('[data-slot="rating-status"]')).toHaveText(
    `${title}: rated 4 stars out of 5.`,
  );
  await expect(communityRating(page)).toContainText("1 Rating so far");

  await page.reload();
  await expect(
    rating.getByRole("radio", { name: "4 stars out of 5" }),
  ).toBeChecked();
  await expect(communityRating(page)).toContainText("1 Rating so far");

  // Kept through a move to Backlog, where it can only be cleared.
  await chooseStatus(page, "backlog");
  await expect(rating.getByText("Rated 4 out of 5")).toBeVisible();
  await expect(rating.getByRole("radio")).toHaveCount(0);
  await rating.getByRole("button", { name: "Clear rating" }).click();
  await expect(communityRating(page)).toContainText("No Ratings yet");
  await page.reload();
  await expect(page.getByRole("group", { name: "Your rating" })).toHaveCount(0);
});

test("the Community rating shows its average and feeds structured data only at the threshold", async ({
  page,
  request,
}) => {
  const below = await seedRatedGame(request, [10, 9, 8, 8]);
  await page.goto(`/games/${below.slug}`);
  await expect(communityRating(page)).toContainText("4 Ratings so far");
  expect(await schemaRating(page)).toBeUndefined();

  const rated = await seedRatedGame(request, [10, 9, 8, 8, 7]);
  await page.goto(`/games/${rated.slug}`);
  const card = communityRating(page);
  await expect(card).toContainText("4.2");
  await expect(card).toContainText("5 Ratings");
  await card.getByText("View rating data").click();
  await expect(card.getByRole("row", { name: "4 stars 2" })).toBeVisible();
  await expect
    .poll(() => schemaRating(page))
    .toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.2,
      ratingCount: 5,
      bestRating: 5,
      worstRating: 0.5,
    });
});

test("a guest's Sign in to record and rate returns to the game", async ({
  page,
}) => {
  await page.goto("/games/celeste");
  await expect(page.getByText("Sign in to rate")).toHaveCount(0);
  await page
    .getByRole("region", { name: "Game journal" })
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fgames%2Fceleste$/);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`rating data fades on pointer opening and stays immediate by keyboard (${reducedMotion})`, async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ reducedMotion });
    const { slug } = await seedRatedGame(request, [10, 9, 8, 8, 7]);
    await page.goto(`/games/${slug}`);
    const card = communityRating(page);
    const summary = card.getByText("View rating data");
    const details = card.locator("details");
    await summary.click();
    await expect(details).toHaveAttribute("open");
    const fade = await details.evaluate((element) => {
      const style = getComputedStyle(element, "::details-content");
      return {
        property: style.transitionProperty,
        duration: style.transitionDuration,
      };
    });
    expect(fade).toEqual({
      property: "opacity",
      duration: reducedMotion === "reduce" ? "0.15s" : "0.2s",
    });
    await summary.click();
    await expect(details).not.toHaveAttribute("open");
    await summary.press("Enter");
    await expect(details).toHaveAttribute("open");
    expect(
      await details.evaluate(
        (element) =>
          getComputedStyle(element, "::details-content").transitionDuration,
      ),
    ).toBe("0s");
    await expect(card.getByRole("row", { name: "4 stars 2" })).toBeVisible();
    await summary.press("Space");
    await expect(details).not.toHaveAttribute("open");
    await expect(summary).toBeFocused();
  });
}
