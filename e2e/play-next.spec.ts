import AxeBuilder from "@axe-core/playwright";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { chooseTheme } from "./support/header";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";
import { supportUrl } from "./support/url";

async function seed(request: APIRequestContext, username: string, count = 7) {
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, cover_image_id, genres, tags, platforms, synced_at) select 940001+i, 'Play Next Fixture ' || (i+1), 'play-next-fixture-' || (i+1), null, array['Adventure'], array[]::text[], array['PC','Play Next Future Port'], now() from generate_series(0,8) i on conflict do nothing`,
      `insert into release_date (game_id, platform, region, date, precision) select 940001+i, 'PC', 'worldwide', '2020-01-01', 'day' from generate_series(0,8) i on conflict do nothing`,
      `insert into journal_entry (user_id,game_id,status,updated_at) select u.id, 940001+i, 'backlog', now() from "user" u cross join generate_series(0,${count - 1}) i where u.username=$1 on conflict do nothing`,
    ],
    [username],
  );
}
async function state(request: APIRequestContext, username: string) {
  const response = await request.post(supportUrl("/query"), {
    data: {
      sql: `select j.game_id,j.status,(select count(*)::int from playthrough p where p.user_id=j.user_id and p.game_id=j.game_id) as playthroughs from journal_entry j join "user" u on u.id=j.user_id where u.username=$1 order by j.game_id`,
      params: [username],
    },
  });
  return (await response.json()).rows;
}
async function filter(page: Page, label: string, value: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Play next updates" }),
  ).not.toContainText("Loading");
}

test("Home and Backlog reach one Shelf; browsing, filtering and rerolls never mutate the Journal", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("next");
  await signUp(page, request, username);
  await seed(request, username);
  const before = await state(request, username);
  await page
    .getByRole("link", { name: "What should I play next?", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "My Backlog", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article")).toHaveCount(3);
  const first = await page.getByRole("article").allTextContents();
  await page
    .getByRole("button", { name: "Show different games", exact: true })
    .click();
  const second = await page.getByRole("article").allTextContents();
  expect(second.some((text) => first.includes(text))).toBe(false);
  await page
    .getByRole("button", { name: "Show different games", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Reshuffle games", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await filter(page, "Available on", "Play Next Future Port");
  await expect(
    page.getByRole("heading", { name: "No games match these filters" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(3);
  expect(await state(request, username)).toEqual(before);
  await page.goto("/library?status=backlog");
  await page
    .getByRole("link", { name: "What should I play next?", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(3);
});

test("cancel retains the shortlist and focus; confirmed start changes only Status", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("start");
  await signUp(page, request, username);
  await seed(request, username, 2);
  await page.goto("/play-next");
  const choose = page.getByRole("button", { name: /^Choose this/ }).first();
  const label = await choose.getAttribute("aria-label");
  await choose.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(choose).toBeFocused();
  expect(
    (await state(request, username)).every(
      (row: unknown[]) => row[1] === "backlog",
    ),
  ).toBe(true);
  await choose.click();
  await page
    .getByRole("button", { name: "Set Status to Playing", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: label?.replace("Choose this for ", ""),
      exact: true,
    }),
  ).toBeFocused();
  const saved = await state(request, username);
  expect(saved.filter((row: unknown[]) => row[1] === "playing")).toHaveLength(
    1,
  );
  expect(saved.every((row: unknown[]) => row[2] === 0)).toBe(true);
  await page.getByRole("button", { name: "Back to suggestions" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("Discover excludes the complete Journal, saves explicitly, and recovers after saving a batch", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("discover");
  await signUp(page, request, username);
  await seed(request, username, 1);
  await seedSql(
    request,
    [
      `insert into journal_entry(user_id,game_id,status,updated_at) select id,940003,'wishlist',now() from "user" where username=$1`,
    ],
    [username],
  );
  await page.goto("/play-next");
  await page
    .getByRole("button", { name: "Discover games", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Related to your Backlog" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Play Next Fixture 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "Play Next Fixture 3", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: /^Save to Backlog/ })
      .first()
      .click();
    await expect(page.getByRole("article")).toHaveCount(2 - i);
  }
  await expect(
    page.getByRole("heading", { name: "You’ve seen every match" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "You’ve seen every match" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Show different games" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Show popular games" }).click();
  await expect(
    page.getByRole("heading", { name: "Popular games" }),
  ).toBeVisible();
  const saved = await state(request, username);
  expect(saved.filter((row: unknown[]) => row[1] === "backlog")).toHaveLength(
    4,
  );
  expect(saved.every((row: unknown[]) => row[2] === 0)).toBe(true);
});

test("empty Backlog defaults to labeled popularity and retains filters on source changes", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("empty"));
  await page.goto("/play-next");
  await expect(
    page.getByRole("heading", { name: "Popular games" }),
  ).toBeVisible();
  await filter(page, "Available on", "PC");
  await filter(page, "Genre", "Puzzle");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "My Backlog", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Backlog is clear" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Genre", exact: true }),
  ).toContainText("Puzzle");
  await page
    .getByRole("button", { name: "Discover games", exact: true })
    .last()
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("a stale start cannot replace a Status changed in another tab", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("stale");
  await signUp(page, request, username);
  await seed(request, username, 1);
  await page.goto("/play-next");
  await page.getByRole("button", { name: /^Choose this/ }).click();
  await seedSql(
    request,
    [
      `update journal_entry set status='wishlist',updated_at=updated_at+interval '1 second' where user_id=(select id from "user" where username=$1)`,
    ],
    [username],
  );
  await page
    .getByRole("button", { name: "Set Status to Playing", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "changed in another tab",
  );
  expect((await state(request, username))[0][1]).toBe("wishlist");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("expired session cannot save a displayed choice", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("expire");
  await signUp(page, request, username);
  await seed(request, username, 1);
  await page.goto("/play-next");
  await page.getByRole("button", { name: /^Choose this/ }).click();
  await page.context().clearCookies();
  await page
    .getByRole("button", { name: "Set Status to Playing", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Sign in to continue", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  expect((await state(request, username))[0][1]).toBe("backlog");
});

test("Shelf is accessible and fits both themes from 320px to desktop", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("a11ynext"));
  await page.goto("/play-next");
  await expect(page.getByRole("article")).toHaveCount(3);
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `/tmp/play-next-${theme}-${width}.png`,
          fullPage: true,
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page
    .getByRole("button", { name: /^Choose this/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
});

test("provider failure offers Retry with filters retained; late responses cannot replace newer choices", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("retry");
  const platform = `Play Next Control ${username}`;
  await signUp(page, request, username);
  await seed(request, username, 1);
  await seedSql(
    request,
    [`update game set platforms=array_append(platforms,$1) where id=940001`],
    [platform],
  );
  await request.post(supportUrl("/play-next-source"), {
    data: { key: platform, fail: true },
  });
  await page.goto("/play-next");
  await page
    .getByRole("button", { name: "Discover games", exact: true })
    .click();
  await filter(page, "Available on", platform);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Couldn’t load suggestions",
  );
  await expect(
    page.getByRole("heading", { name: "Popular games" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Available on" }),
  ).toContainText(platform);
  await request.post(supportUrl("/play-next-source"), {
    data: { key: platform, fail: false, delay: 500 },
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("combobox", { name: "Available on" }).click();
  await page.getByRole("option", { name: "PC", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(
    page.getByRole("combobox", { name: "Available on" }),
  ).toContainText("PC");
  await expect(
    page.getByRole("heading", { name: "Related to your Backlog" }),
  ).toBeVisible();
});
