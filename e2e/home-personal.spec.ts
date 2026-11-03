import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { seedSql } from "./support/seed-sql";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";

test("Home summaries, compact personal shelves, addition order and region-aware Wishlist agree with collections", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const email = await signUp(page, request, `personal78_${Date.now()}`);
  await expect(
    page.getByRole("link", { name: "All saved games (0)" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Backlog (0)" })).toHaveAttribute(
    "href",
    "/library?status=backlog",
  );
  await expect(
    page.getByRole("link", { name: "Wishlist (0)" }),
  ).toHaveAttribute("href", "/wishlist");
  await expect(
    page.getByRole("region", { name: "Wishlist release preview" }),
  ).toHaveCount(0);
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, genres, platforms, synced_at)
     select n, 'Home collection game ' || n || case when n = 78011 then ' with a very long name that should remain readable on small screens' else '' end, 'home-collection-' || n, '{}', '{PC}', now()
     from generate_series(78010, 78015) n on conflict (id) do nothing`,
      `insert into journal_entry (user_id, game_id, status, created_at, updated_at)
     select id, 78010, 'playing', '2026-01-01', '2026-01-01' from "user" where email = $1`,
    ],
    [email],
  );
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Playing" }).getByRole("listitem"),
  ).toHaveCount(1);
  await seedSql(
    request,
    [
      `insert into journal_entry (user_id, game_id, status, created_at, updated_at)
     select id, 78011, 'wishlist', '2026-02-01', '2026-02-01' from "user" where email = $1`,
      `insert into release_date (game_id, region, date, precision)
     select 78011, 'japan', '2098-11-05', 'day' where not exists (select 1 from release_date where game_id = 78011 and region = 'japan')`,
      `insert into release_date (game_id, region, date, precision)
     select 78011, 'europe', '2099-12-10', 'day' where not exists (select 1 from release_date where game_id = 78011 and region = 'europe')`,
      `update "user" set region = 'europe' where email = $1`,
      `insert into playthrough (user_id, game_id, platform, started_on, notes)
     select id, 78011, 'PC', '2026-01-01', 'Home secret must stay private' from "user" where email = $1`,
    ],
    [email],
  );
  const homeResponse = await page.reload();
  expect(await homeResponse?.text()).not.toContain(
    "Home secret must stay private",
  );
  await expect(
    page.getByRole("link", { name: "All saved games (2)" }),
  ).toBeVisible();
  const preview = page.getByRole("region", {
    name: "Wishlist release preview",
  });
  await expect(
    preview.getByRole("link", { name: /^Home collection game 78011/ }),
  ).toBeVisible();
  await expect(preview).toContainText("Dec 10, 2099");
  await expect(page.getByText("Home secret must stay private")).toHaveCount(0);
  await page.goto("/wishlist");
  await expect(page.getByRole("region", { name: /^Upcoming/ })).toContainText(
    "Dec 10, 2099",
  );
  await page.goto("/");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"] as const) {
      await chooseTheme(page, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await snap(page, testInfo, `home-two-${width}-${theme}`, true);
    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await snap(page, testInfo, "home-two-enlarged-phone", true);
  await seedSql(
    request,
    [
      `insert into journal_entry (user_id, game_id, status, created_at, updated_at)
     select u.id, n, case n when 78012 then 'played' when 78013 then 'backlog' else 'playing' end,
     '2026-03-01', '2026-03-01' from "user" u cross join generate_series(78012, 78015) n where u.email = $1`,
      `update journal_entry set status = 'backlog', updated_at = now()
     where game_id = 78010 and user_id = (select id from "user" where email = $1)`,
    ],
    [email],
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: "All saved games (6)" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Backlog (2)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wishlist (1)" })).toBeVisible();
  const recent = page.getByRole("region", { name: "Recently added" });
  await expect(recent.getByRole("listitem")).toHaveCount(4);
  await expect(recent.getByRole("listitem")).toContainText([
    "Home collection game 78012",
    "Home collection game 78013",
    "Home collection game 78014",
    "Home collection game 78015",
  ]);
  await expect(
    page.getByRole("link", { name: "All saved games (6)" }),
  ).toBeInViewport();
  await snap(page, testInfo, "home-six-phone", true);
  const summaryBox = await page
    .getByRole("link", { name: "All saved games (6)" })
    .boundingBox();
  const shelfBox = await recent.boundingBox();
  expect(summaryBox?.y).toBeLessThan(shelfBox?.y ?? 0);
  await page.getByRole("link", { name: "View all Playing games" }).click();
  await expect(page).toHaveURL("/library?status=playing");
  await page.goto("/");
  await page
    .getByRole("link", { name: "View all Recently added games" })
    .click();
  await expect(page).toHaveURL("/library?sort=added");
});

test("direct Home status changes reconcile release preview and counts without changing addition order or private history", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, `integrated78_${Date.now()}`);
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, genres, tags, platforms, synced_at)
     values (78101, 'Home integration older', 'home-integration-older', '{}', '{}', '{PC}', now()),
            (78102, 'Home integration newer', 'home-integration-newer', '{}', '{}', '{PC}', now())
     on conflict (id) do nothing`,
      `insert into journal_entry (user_id, game_id, status, created_at, updated_at)
     select id, 78101, 'backlog', '2026-01-01', '2026-01-01' from "user" where email = $1`,
      `insert into journal_entry (user_id, game_id, status, created_at, updated_at)
     select id, 78102, 'playing', '2026-02-01', '2026-02-01' from "user" where email = $1`,
      `insert into release_date (game_id, region, date, precision)
     select 78101, 'japan', '2098-11-05', 'day' where not exists (select 1 from release_date where game_id = 78101 and region = 'japan')`,
      `insert into release_date (game_id, region, date, precision)
     select 78101, 'europe', '2099-12-10', 'day' where not exists (select 1 from release_date where game_id = 78101 and region = 'europe')`,
      `update "user" set region = 'europe' where email = $1`,
      `insert into playthrough (user_id, game_id, platform, started_on, notes)
     select id, 78101, 'PC', '2026-01-01', 'Integrated private history' from "user" where email = $1`,
    ],
    [email],
  );
  await page.route("**/api/games/search?**", (route) =>
    route.fulfill({
      json: [
        {
          id: 78101,
          title: "Home integration older",
          slug: "home-integration-older",
          coverImageId: null,
          year: 2098,
          platforms: ["PC"],
        },
      ],
    }),
  );
  const response = await page.goto("/?q=Home%20integration");
  expect(await response?.text()).not.toContain("Integrated private history");
  const recent = page.getByRole("region", {
    name: "Recently added",
    exact: true,
  });
  const search = page.getByRole("list", { name: "Search results" });
  const preview = page.getByRole("region", {
    name: "Wishlist release preview",
  });
  await expect(recent.getByRole("listitem")).toContainText([
    "Home integration newer",
    "Home integration older",
  ]);
  await search
    .getByRole("button", { name: "Change status for Home integration older" })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "All saved games (2)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Backlog (0)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Wishlist (1)", exact: true }),
  ).toBeVisible();
  await expect(preview).toContainText("Dec 10, 2099");
  await expect(recent.getByRole("listitem")).toContainText([
    "Home integration newer",
    "Home integration older",
  ]);
  await expect(recent.getByText("Wishlisted", { exact: true })).toBeVisible();
  await recent
    .getByRole("button", { name: "Change status for Home integration older" })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Backlog", exact: true })
    .click();
  await expect(preview).toHaveCount(0);
  await expect(search.getByText("In backlog", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Backlog (1)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(recent.getByRole("listitem")).toContainText([
    "Home integration newer",
    "Home integration older",
  ]);
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(
    exported.entries.find((entry: { gameId: number }) => entry.gameId === 78101)
      .createdAt,
  ).toContain("2026-01-01");
  expect(exported.playthroughs).toEqual([
    expect.objectContaining({
      gameId: 78101,
      notes: "Integrated private history",
    }),
  ]);
});
