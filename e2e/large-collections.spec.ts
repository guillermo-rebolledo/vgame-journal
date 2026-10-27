import { expect, test } from "@playwright/test";
import { signUp } from "./support/sign-up";

test("large collections bound rendered rows and retain navigation, search and editing", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const username = `large_${testInfo.workerIndex}_${Date.now()}`;
  const email = await signUp(page, request, username);
  for (const sql of [
    `insert into game (id, title, slug, genres, platforms, synced_at)
     select n, 'Collection game ' || n, 'collection-' || n, '{}', '{PC}', now()
     from generate_series(10000, 10999) n on conflict (id) do nothing`,
    `insert into journal_entry (user_id, game_id, status, updated_at)
     select u.id, n, 'wishlist', now() from "user" u
     cross join generate_series(10000, 10999) n where u.email = $1`,
    `insert into release_date (game_id, platform, region, date, precision)
     select n, 'PC', 'worldwide', '2099-01-01', 'day' from generate_series(10000, 10999) n
     where not exists (select 1 from release_date where game_id = n)`,
    `insert into status_event (user_id, game_id, status, at)
     select u.id, 10000, case when n % 2 = 0 then 'backlog' else 'wishlist' end,
     timestamp '2020-01-01' + n * interval '1 day' from "user" u
     cross join generate_series(0, 999) n where u.email = $1`,
    `insert into playthrough (user_id, game_id, platform, started_on, hours, notes)
     select u.id, 10000, 'PC', date '2020-01-01' + n, 1, 'Private session ' || n from "user" u
     cross join generate_series(0, 99) n where u.email = $1`,
  ]) {
    const response = await request.post("http://127.0.0.1:3101/query", {
      data: { sql, params: sql.includes("$1") ? [email] : [] },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  await page.goto("/library");
  const games = page.getByRole("list", { name: "Games", exact: true });
  await expect(games).toBeVisible();
  await expect(
    page.getByText("1000 games", { exact: true }).filter({ visible: true }),
  ).toBeVisible();

  // Timing is diagnostic; the row bounds below are the deterministic regression check.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const samples = [];
  for (const name of [
    "Wishlist",
    "Stats",
    "Library",
    "Wishlist",
    "Stats",
    "Library",
  ]) {
    const before = await cdp.send("Performance.getMetrics");
    const sampling = page.evaluate(
      () =>
        new Promise<{ slowFrames: number; maxFrameMs: number }>((resolve) => {
          let previous = performance.now();
          const end = previous + 750;
          let slowFrames = 0;
          let maxFrameMs = 0;
          function sample(time: number) {
            const gap = time - previous;
            maxFrameMs = Math.max(maxFrameMs, gap);
            if (gap > 25) slowFrames++;
            previous = time;
            if (time < end) requestAnimationFrame(sample);
            else resolve({ slowFrames, maxFrameMs });
          }
          requestAnimationFrame(sample);
        }),
    );
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true, level: 1 }),
    ).toBeVisible();
    if (name === "Stats")
      await expect(
        page.getByRole("img", { name: /Backlog size over time/ }),
      ).toBeVisible();
    else
      await expect(
        page.getByText("1000 games", { exact: true }).filter({ visible: true }),
      ).toBeVisible({ timeout: 30_000 });
    const frames = await sampling;
    const after = await cdp.send("Performance.getMetrics");
    const duration = (key: string) =>
      1000 *
      ((after.metrics.find((m) => m.name === key)?.value ?? 0) -
        (before.metrics.find((m) => m.name === key)?.value ?? 0));
    samples.push({
      name,
      ...frames,
      scriptMs: duration("ScriptDuration"),
      layoutMs: duration("LayoutDuration"),
      rows: await page.locator("main li:visible").count(),
    });
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  console.log("Large collection profile:", JSON.stringify(samples));
  await testInfo.attach("large-collection-profile", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  await expect(games.getByRole("listitem")).toHaveCount(48);
  const libraryPages = page.getByRole("navigation", {
    name: "Library games pages",
  });
  await libraryPages.getByRole("button", { name: "Next" }).click();
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 1000");
  await expect(
    page.getByRole("group", { name: "Library games" }),
  ).toBeFocused();
  const firstTitle = await games.getByRole("heading").first().textContent();
  await games.getByRole("link").first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: firstTitle ?? "" }),
  ).toBeVisible();
  await page.goBack();
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 1000");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(games.getByRole("listitem")).toHaveCount(48);
  await page.getByRole("searchbox").fill("10999");
  await expect(games.getByRole("listitem")).toHaveCount(1);
  await expect(games.getByRole("heading")).toContainText(
    "Collection game 10999",
  );
  await page.getByRole("searchbox").clear();
  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
  await page.setViewportSize({ width: 390, height: 844 });
  await libraryPages.getByRole("button", { name: "Next" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("library-mobile.png"),
    fullPage: true,
  });

  await page.goto("/wishlist");
  const upcoming = page.getByRole("region", { name: /Upcoming/ });
  await expect(upcoming.getByRole("listitem")).toHaveCount(48);
  await upcoming.getByRole("button", { name: "Next" }).click();
  await expect(upcoming.getByRole("status")).toHaveText("49–96 of 1000");
  await expect(upcoming.getByRole("listitem")).toHaveCount(48);

  await page.goto(`/u/${username}`);
  await expect(games.getByRole("listitem")).toHaveCount(48);
  const publicHistory = page.getByRole("group", {
    name: "Public playthroughs",
  });
  await expect(publicHistory.getByRole("listitem")).toHaveCount(48);
  await expect(page.getByText(/Private session/)).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Public playthroughs pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect(publicHistory.getByRole("listitem")).toHaveCount(48);

  await page.goto("/stats");
  await expect(
    page.getByRole("img", { name: /Backlog size over time/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Backlog size over time/ }).locator("circle"),
  ).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await page
    .getByText("View backlog data", { exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("row")).toHaveCount(49);
  await page
    .getByRole("navigation", { name: "Backlog data pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect(page.getByRole("row")).toHaveCount(49);

  await page.goto("/games/collection-10000");
  const history = page.getByRole("group", { name: "Playthrough history" });
  await expect(history.getByRole("listitem")).toHaveCount(48);
  await expect(
    history.getByRole("button", { name: "Save", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Playthrough history pages" })
    .getByRole("button", { name: "Next" })
    .click();
  const row = history.getByRole("listitem").first();
  await expect(row).toContainText("Private session 48");
  await row.getByText("Edit", { exact: true }).click();
  await row.getByLabel("Hours").fill("2");
  await row.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row).toContainText("2 h");
  await row.getByRole("button", { name: "Delete playthrough" }).click();
  await expect(history).not.toContainText("Private session 48");
  await expect(history.getByRole("listitem")).toHaveCount(48);
});
