import { expect, type Page, test } from "@playwright/test";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";

const titles = (page: Page) =>
  page
    .getByRole("list", { name: "Games", exact: true })
    .getByRole("heading")
    .allTextContents();

test("the Rated filter and Rating sort work in the Library and on the public profile, and Stats report Ratings", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("ratings_library");
  const email = await signUp(page, request, username);
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, genres, platforms, synced_at) values
       (126001, 'Rated Alpha', 'rated-alpha-126', '{}', '{PC}', now()),
       (126002, 'Rated Beta', 'rated-beta-126', '{}', '{PC}', now()),
       (126003, 'Unrated Gamma', 'unrated-gamma-126', '{}', '{PC}', now())
       on conflict do nothing`,
      `insert into journal_entry (user_id, game_id, status, rating, rated_at, updated_at)
       select u.id, g.id, g.status, g.rating, case when g.rating is null then null else now() end, now()
       from "user" u cross join (values
         (126001, 'playing', 4), (126002, 'played', 9), (126003, 'backlog', null::smallint)
       ) g(id, status, rating) where u.email = $1`,
    ],
    [email],
  );

  await page.goto("/library");
  await expect.poll(() => titles(page)).toHaveLength(3);
  await page.getByLabel("Rating", { exact: true }).selectOption("Rated");
  await page.getByLabel("Sort by").selectOption("Rating (highest first)");
  await expect.poll(() => titles(page)).toEqual(["Rated Beta", "Rated Alpha"]);
  await expect(page).toHaveURL(/\?rated=1&sort=rating$/);
  await expect(
    page
      .getByRole("link", { name: /Rated Beta/ })
      .getByText("Rated 4.5 out of 5"),
  ).toBeAttached();

  await page.reload();
  await expect.poll(() => titles(page)).toEqual(["Rated Beta", "Rated Alpha"]);

  await page.getByRole("button", { name: "List" }).click();
  await expect(
    page
      .getByRole("link", { name: /Rated Alpha/ })
      .getByText("Rated 2 out of 5"),
  ).toBeAttached();

  await page.goto("/stats");
  const yours = page.getByRole("region", { name: "Your ratings" });
  await expect(yours.getByText("Average 3.3 out of 5")).toBeVisible();
  await expect(yours.getByText("2 rated games")).toBeVisible();

  await page.goto(`/u/${username}?rated=1&sort=rating`);
  await expect.poll(() => titles(page)).toEqual(["Rated Beta", "Rated Alpha"]);
  await expect(page.getByLabel("Rating", { exact: true })).toHaveValue("rated");
  await page.getByLabel("Rating", { exact: true }).selectOption("Any rating");
  await expect.poll(() => titles(page)).toHaveLength(3);
  await expect(page).toHaveURL(new RegExp(`/u/${username}\\?sort=rating$`));

  await page.getByRole("button", { name: "Stats" }).click();
  const theirs = page.getByRole("region", { name: "Ratings", exact: true });
  await expect(theirs.getByText("Average 3.3 out of 5")).toBeVisible();
});
