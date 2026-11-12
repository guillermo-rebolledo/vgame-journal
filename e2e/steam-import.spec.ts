import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";
import { supportUrl } from "./support/url";

test("Steam discovery is owner-only and disappears when the flag is off", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByText("Have games on Steam?")).toHaveCount(0);
  const username = uniqueUsername("steamdiscover");
  const email = await signUp(page, request, username);
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/library");
      await expect(
        page.getByRole("link", { name: "Import from Steam" }),
      ).toHaveCount(2);
      await expect(
        page.getByRole("main").getByRole("link", { name: "Find a game" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath(`steam-discovery-${theme}.png`),
      fullPage: true,
    });
  }
  await seedSql(
    request,
    [`update "user" set profile_visibility = 'public' where email = $1`],
    [email],
  );
  await page.goto(`/u/${username}`);
  await expect(page.getByText("No games in this library yet.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Import from Steam" }),
  ).toHaveCount(0);
  await request.post(supportUrl("/steam-flag"), {
    data: { username, enabled: false },
  });
  for (const path of ["/", "/library", "/settings"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", {
        name:
          path === "/"
            ? "Your Journal"
            : path === "/library"
              ? "Library"
              : "Settings",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Have games on Steam?")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Import.*Steam|Sign in through Steam/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Steam import" }),
    ).toHaveCount(0);
    await expect(page.getByText("Loading Steam connection…")).toHaveCount(0);
  }
  await page.goto("/settings/steam");
  await expect(page.getByRole("heading", { name: "Steam import" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Sign in through Steam" }),
  ).toHaveCount(0);
});

test("connect, hidden-then-fixed retry, review, commit and re-import preserve Journal choices", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const email = await signUp(page, request, uniqueUsername("steam"));
  await request.post(supportUrl("/steam-fixture"), { data: { response: {} } });
  await page.route("**/api/steam/connect", async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const login = new URL(response.headers().location);
    const callback = new URL(
      login.searchParams.get("openid.return_to") as string,
    );
    const returnTo = callback.href;
    const identity = "https://steamcommunity.com/openid/id/76561198000000000";
    for (const [key, value] of Object.entries({
      ns: "http://specs.openid.net/auth/2.0",
      mode: "id_res",
      op_endpoint: "https://steamcommunity.com/openid/login",
      return_to: returnTo,
      claimed_id: identity,
      identity,
      signed:
        "op_endpoint,return_to,claimed_id,identity,response_nonce,assoc_handle",
      response_nonce: `${new Date().toISOString()}fixture`,
      assoc_handle: "fixture",
      sig: "fixture-signature",
    }))
      callback.searchParams.set(`openid.${key}`, value);
    await route.fulfill({
      status: 302,
      headers: { location: callback.href },
    });
  });
  await page.goto("/");
  await expect(page.getByText("Have games on Steam?")).toBeVisible();
  await page.getByRole("link", { name: "Import from Steam" }).click();
  await expect(page).toHaveURL(/\/settings\/steam$/);
  await page.getByRole("link", { name: "Sign in through Steam" }).click();
  await expect(page).toHaveURL(/\/settings\/steam$/);
  await page.getByRole("button", { name: "Start Steam import" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Game details could not be read" }),
  ).toBeVisible();
  const games = [
    { appid: 620, name: "Steam first game", playtime_forever: 100 },
    { appid: 621, name: "Steam second game", rtime_last_played: 100 },
    { appid: 999, name: "Unmatched Steam game" },
  ];
  await request.post(supportUrl("/steam-fixture"), {
    data: { response: { game_count: games.length, games } },
  });
  await seedSql(
    request,
    [
      `update steam_link set next_import_at = null where user_id = (select id from "user" where email = $1)`,
    ],
    [email],
  );
  await page.getByRole("button", { name: "Retry Steam import" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Steam first game/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Unmatched Steam game/ }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /Steam second game/ }).uncheck();
  await page.getByRole("button", { name: "Add 1 to Backlog" }).click();
  await expect(
    page.getByText("1 game added to Backlog", { exact: true }),
  ).toBeVisible();
  await page.goto("/library?status=backlog");
  await expect(page.getByRole("link", { name: /Hades/ }).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Import from Steam" }),
  ).toBeVisible();
  // A player's later removal is never undone by another import.
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, genres, platforms, synced_at) values (26855, 'Dead Cells', 'dead-cells', '{}', '{PC}', now()) on conflict (id) do nothing`,
      `insert into status_event (user_id, game_id, status, at) select id, 26855, null, now() from "user" where email = $1`,
      `update steam_link set next_import_at = null where user_id = (select id from "user" where email = $1)`,
    ],
    [email],
  );
  await page.goto("/settings/steam");
  await page.getByRole("button", { name: "Start Steam import" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Already in Journal/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: /Previously removed/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add 0 to Backlog" }),
  ).toBeDisabled();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Disconnect Steam" }).click();
  await expect(
    page
      .getByText("Steam not connected", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  // Selection stays out of reach once the account is disconnected.
  await page.goto("/settings/steam");
  await expect(
    page.getByRole("link", { name: "Sign in through Steam" }),
  ).toBeVisible();
  await page.goto("/library?status=backlog");
  await expect(page.getByRole("link", { name: /Hades/ }).first()).toBeVisible();
});
