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

test("a guest is offered Sign in to rate, which returns to the game", async ({
  page,
}) => {
  await page.goto("/games/celeste");
  await page.getByRole("link", { name: "Sign in to rate" }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fgames%2Fceleste$/);
});
