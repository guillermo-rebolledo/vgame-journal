import { expect, test } from "@playwright/test";
import { signUp } from "./support/sign-up";

test("large collections bound rendered rows and retain navigation, search and editing", async ({
  page,
  request,
  browser,
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
    `insert into playthrough (user_id, game_id, platform, started_on)
     select u.id, n, 'PC', date '2025-01-01' from "user" u
     cross join generate_series(10001, 10099) n where u.email = $1`,
    `insert into playthrough (user_id, game_id, platform, started_on, hours, notes)
     select u.id, 10000, 'PC', date '2020-01-01' + n, 1, 'Private session ' || n from "user" u
     cross join generate_series(0, 99) n where u.email = $1`,
  ]) {
    const response = await request.post("http://127.0.0.1:3101/query", {
      data: { sql, params: sql.includes("$1") ? [email] : [] },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  const delay = await request.post("http://127.0.0.1:3101/collection-delay", {
    data: { email, milliseconds: 1500 },
  });
  expect(delay.ok()).toBeTruthy();
  await page.goto("/library?libraryPage=2&outPage=3", { waitUntil: "commit" });
  await expect(
    page.getByRole("status").filter({ hasText: "Loading your Library…" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/libraryPage=2&outPage=3$/);
  await expect(
    page
      .getByRole("navigation", { name: "Library games pages" })
      .getByRole("status"),
  ).toHaveText("49–96 of 1000");
  await request.post("http://127.0.0.1:3101/collection-delay", {
    data: { email, milliseconds: 0 },
  });
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
  await expect(page).toHaveURL(/libraryPage=2/);
  await expect(
    page.getByRole("group", { name: "Library games" }),
  ).toBeFocused();
  await page.goBack();
  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
  await page.goForward();
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 1000");
  await libraryPages.getByRole("button", { name: "Previous" }).click();
  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
  expect(new URL(page.url()).searchParams.has("libraryPage")).toBe(false);
  await page.goBack();
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 1000");
  await page.reload();
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 1000");

  // Five filters, page position, and an independent collection key survive copied URLs.
  await page.goto(
    "/library?q=Collection&status=wishlist&platform=PC&year=2025&sort=title&libraryPage=2&outPage=3",
  );
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 100");
  const copiedUrl = page.url();
  const copied = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const fresh = await copied.newPage();
    await fresh.goto(copiedUrl);
    await expect(fresh.getByLabel("Search your Library")).toHaveValue(
      "Collection",
    );
    for (const [label, value] of [
      ["Status", "wishlist"],
      ["Platform", "PC"],
      ["Year played", "2025"],
      ["Sort by", "title"],
    ])
      await expect(fresh.getByLabel(label, { exact: true })).toHaveValue(value);
    await expect(
      fresh
        .getByRole("navigation", { name: "Library games pages" })
        .getByRole("status"),
    ).toHaveText("49–96 of 100");
    await expect(
      fresh
        .getByRole("list", { name: "Games", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(48);
  } finally {
    await copied.close();
  }
  const firstTitle = await games.getByRole("heading").first().textContent();
  await games.getByRole("link").first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: firstTitle ?? "" }),
  ).toBeVisible();
  await page.goBack();
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 100");
  await expect(page.getByLabel("Search your Library")).toHaveValue(
    "Collection",
  );
  for (const [label, value] of [
    ["Status", ""],
    ["Platform", ""],
    ["Year played", ""],
    ["Sort by", "released"],
  ]) {
    await page.goto(copiedUrl);
    await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 100");
    await page.getByLabel(label, { exact: true }).selectOption(value);
    expect(new URL(page.url()).searchParams.has("libraryPage")).toBe(false);
    expect(new URL(page.url()).searchParams.get("outPage")).toBe("3");
    await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 100");
  }
  await page.goto(copiedUrl);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page).toHaveURL(/libraryPage=2/);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByLabel("Search your Library")).toHaveValue("");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Sort by")).toHaveValue("added");
  await expect(
    page.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
  await page.reload();
  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
  await page.goto(copiedUrl);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/library\?sort=title&outPage=3$/);
  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
  await expect(games.getByRole("listitem")).toHaveCount(48);
  await page.getByRole("searchbox").fill("10999");
  await expect(games.getByRole("listitem")).toHaveCount(1);
  await expect(games.getByRole("heading")).toContainText(
    "Collection game 10999",
  );
  await page.getByRole("searchbox").clear();
  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
  // Query edits replace one history entry and reset the page atomically.
  await libraryPages.getByRole("button", { name: "Next" }).click();
  const historyLength = await page.evaluate(() => window.history.length);
  await page.getByRole("searchbox").pressSequentially("Collection game 109");
  await expect(page.getByRole("searchbox")).toHaveValue("Collection game 109");
  expect(new URL(page.url()).searchParams.get("q")).toBe("Collection game 109");

  await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 100");
  expect(new URL(page.url()).searchParams.has("libraryPage")).toBe(false);
  expect(new URL(page.url()).searchParams.get("outPage")).toBe("3");
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  await page.getByRole("button", { name: "Clear filters" }).click();

  // Invalid positions and empty matches canonicalize only this collection's key.
  for (const value of ["nope", "2.5", "0", "-2"]) {
    await page.goto(`/library?libraryPage=${value}&outPage=3&sort=title`);
    await expect(libraryPages.getByRole("status")).toHaveText("1–48 of 1000");
    await expect(page).toHaveURL(/\/library\?outPage=3&sort=title$/);
  }
  await page.goto("/library?q=NoSuchCollection&libraryPage=2&outPage=3");
  await expect(page.getByText("No games match these filters.")).toBeVisible();
  await expect(page).toHaveURL(/\/library\?q=NoSuchCollection&outPage=3$/);
  await page.goto("/library?libraryPage=999&outPage=3&sort=title");
  await expect(libraryPages.getByRole("status")).toHaveText("961–1000 of 1000");
  await expect(page).toHaveURL(/libraryPage=21&outPage=3&sort=title$/);
  const shrink = await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `delete from journal_entry where user_id = (select id from "user" where email = $1) and game_id >= 10960`,
      params: [email],
    },
  });
  expect(shrink.ok(), await shrink.text()).toBeTruthy();
  await page.reload();
  await expect(libraryPages.getByRole("status")).toHaveText("913–960 of 960");
  await expect(page).toHaveURL(/libraryPage=20&outPage=3&sort=title$/);
  const restore = await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `insert into journal_entry (user_id, game_id, status, updated_at) select u.id, n, 'wishlist', now() from "user" u cross join generate_series(10960,10999) n where u.email = $1`,
      params: [email],
    },
  });
  expect(restore.ok(), await restore.text()).toBeTruthy();
  await page.goto("/library");
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
  await libraryPages.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/libraryPage=2/);
  await page.reload();
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 1000");
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
  await page.getByLabel("Hours (optional)").fill("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row).toContainText("2 h");
  await row.getByText("Edit", { exact: true }).click();
  await page.getByRole("button", { name: "Delete playthrough" }).click();
  await expect(history).not.toContainText("Private session 48");
  await expect(history.getByRole("listitem")).toHaveCount(48);
});
