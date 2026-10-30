import { expect, test } from "@playwright/test";
import { seedSql } from "./support/seed-sql";
import { signUp } from "./support/sign-up";

test("large collections bound rendered rows and retain navigation, search and editing", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const username = `large_${testInfo.workerIndex}_${Date.now()}`;
  const email = await signUp(page, request, username);
  await seedSql(
    request,
    [
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
    ],
    [email],
  );
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
  // F14: independent public Library and Playthrough positions survive copied guest links.
  await expect(page).toHaveURL(/libraryPage=2&publicPlaythroughPage=2/);
  await page.reload();
  await expect(publicHistory.getByRole("listitem")).toHaveCount(48);
  await expect(libraryPages.getByRole("status")).toHaveText("49–96 of 1000");
  await page.goBack();
  await expect(
    page
      .getByRole("navigation", { name: "Public playthroughs pages" })
      .getByRole("status"),
  ).toHaveText("1–48 of 199");
  await page.goForward();
  const publicUrl = `/u/${username}?view=library&q=Collection&status=wishlist&platform=PC&year=2025&sort=title&libraryPage=2&publicPlaythroughPage=3&outPage=2&marker=keep`;
  const guest = await browser.newContext();
  try {
    const fresh = await guest.newPage();
    const payloads: Promise<string>[] = [];
    fresh.on("response", (response) => {
      if (response.url().includes(`/u/${username}`))
        payloads.push(response.text().catch(() => ""));
    });
    await fresh.goto(publicUrl);
    await expect(
      fresh
        .getByRole("navigation", { name: "Library games pages" })
        .getByRole("status"),
    ).toHaveText("49–96 of 100");
    await expect(
      fresh
        .getByRole("navigation", { name: "Public playthroughs pages" })
        .getByRole("status"),
    ).toHaveText("97–144 of 199");
    await fresh
      .getByRole("group", { name: "Public playthroughs" })
      .getByRole("link")
      .first()
      .click();
    await expect(fresh).toHaveURL(/\/games\/collection-/);
    await fresh.goBack();
    await expect(
      fresh
        .getByRole("navigation", { name: "Library games pages" })
        .getByRole("status"),
    ).toHaveText("49–96 of 100");
    await expect(
      fresh
        .getByRole("navigation", { name: "Public playthroughs pages" })
        .getByRole("status"),
    ).toHaveText("97–144 of 199");
    await fresh.getByLabel("Search your Library").fill("10099");
    await expect(
      fresh
        .getByRole("list", { name: "Games", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(1);
    expect(new URL(fresh.url()).searchParams.has("libraryPage")).toBe(false);
    for (const [key, value] of [
      ["view", "library"],
      ["publicPlaythroughPage", "3"],
      ["outPage", "2"],
      ["marker", "keep"],
    ])
      expect(new URL(fresh.url()).searchParams.get(key)).toBe(value);
    const payload = (await Promise.all(payloads)).join("\n");
    expect(payload).not.toContain("Private session");
    expect(payload).not.toContain(email);
    expect(payload).not.toContain("calendarToken");
    await expect(
      fresh.getByRole("button", { name: "Edit", exact: true }),
    ).toHaveCount(0);
    for (const value of ["nope", "0", "-1", "1.5", "999"]) {
      await fresh.goto(
        `/u/${username}?libraryPage=2&publicPlaythroughPage=${value}&marker=keep`,
      );
      await expect(
        fresh
          .getByRole("navigation", { name: "Public playthroughs pages" })
          .getByRole("status"),
      ).toHaveText(value === "999" ? "193–199 of 199" : "1–48 of 199");
      await expect(fresh).toHaveURL(
        value === "999"
          ? /publicPlaythroughPage=5/
          : /libraryPage=2&marker=keep$/,
      );
    }
    const peer = `peer_${testInfo.workerIndex}_${Date.now()}`;
    await seedSql(
      request,
      [
        `insert into "user" (id, name, email, username) values ($1, 'Peer', $1 || '@example.com', $1)`,
        `insert into journal_entry (user_id, game_id, status, updated_at) values ($1, 10000, 'played', now())`,
        `insert into playthrough (user_id, game_id, platform, started_on) values ($1, 10000, 'PC', date '2030-01-01')`,
      ],
      [peer],
    );
    await fresh.goto(
      `/u/${peer}?libraryPage=2&publicPlaythroughPage=2&outPage=2&marker=keep`,
    );
    await expect(
      fresh.getByRole("heading", { name: peer, exact: true }),
    ).toBeVisible();
    await expect(
      fresh
        .getByRole("list", { name: "Games", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(1);
    await expect(
      fresh
        .getByRole("group", { name: "Public playthroughs" })
        .getByRole("listitem"),
    ).toHaveCount(1);
    await expect(
      fresh
        .getByRole("group", { name: "Public playthroughs" })
        .getByText("2030-01-01", { exact: true }),
    ).toBeVisible();
    await expect(fresh).toHaveURL(
      new RegExp(`/u/${peer}\\?outPage=2&marker=keep$`),
    );
  } finally {
    await guest.close();
  }

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
  await expect(page).toHaveURL(/playthroughPage=2/);
  await page.reload();
  await expect(history.getByRole("listitem")).toHaveCount(48);
  await page.goBack();
  await expect(
    page
      .getByRole("navigation", { name: "Playthrough history pages" })
      .getByRole("status"),
  ).toHaveText("1–48 of 100");
  await page.goForward();
  const historyLink = page.url();
  const restored = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const fresh = await restored.newPage();
    await fresh.goto(historyLink);
    await expect(
      fresh
        .getByRole("group", { name: "Playthrough history" })
        .getByRole("listitem")
        .first(),
    ).toContainText("Private session 48");
  } finally {
    await restored.close();
  }
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
  for (const value of ["nope", "0", "-1", "1.5", "999"]) {
    await page.goto(
      `/games/collection-10000?playthroughPage=${value}&outPage=2&marker=keep`,
    );
    await expect(
      page
        .getByRole("navigation", { name: "Playthrough history pages" })
        .getByRole("status"),
    ).toHaveText(value === "999" ? "97–99 of 99" : "1–48 of 99");
    await expect(page).toHaveURL(
      value === "999"
        ? /playthroughPage=3&outPage=2&marker=keep$/
        : /outPage=2&marker=keep$/,
    );
  }
  for (const count of [3, 2, 1]) {
    await expect(history.getByRole("listitem")).toHaveCount(count);
    await history
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Delete playthrough", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(history.getByRole("listitem")).toHaveCount(48);
  await expect(page).toHaveURL(/playthroughPage=2&outPage=2&marker=keep$/);
  await expect(
    page.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toBeFocused();
  const emptyHistory = await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `delete from playthrough where user_id = (select id from "user" where email = $1) and game_id = 10000`,
      params: [email],
    },
  });
  expect(emptyHistory.ok(), await emptyHistory.text()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByText("No playthroughs yet.").filter({ visible: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/collection-10000\?outPage=2&marker=keep$/);
});

test("F14 Wishlist section links retain independent pages through move, Undo and guest navigation", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const username = `sections_${testInfo.workerIndex}_${Date.now()}`;
  const email = await signUp(page, request, username);
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, genres, platforms, synced_at)
     select n, 'Section game ' || n, 'section-' || n, '{}', '{PC}', now()
     from generate_series(20000, 20198) n on conflict (id) do nothing`,
      `insert into journal_entry (user_id, game_id, status, updated_at)
     select u.id, n, 'wishlist', now() from "user" u
     cross join generate_series(20000, 20198) n where u.email = $1`,
      `insert into release_date (game_id, platform, region, date, precision)
     select n, 'PC', 'worldwide', case when n < 20049 then date '2020-01-01' else date '2099-01-01' end, 'day'
     from generate_series(20000, 20148) n where not exists (select 1 from release_date where game_id = n)`,
    ],
    [email],
  );
  const out = page.getByRole("region", { name: /^Out now/ });
  const upcoming = page.getByRole("region", { name: /^Upcoming/ });
  const tba = page.getByRole("region", { name: /^Release date not announced/ });
  const linked = "/wishlist?outPage=2&upcomingPage=2&tbaPage=2&marker=keep";
  await page.goto(linked);
  await expect(out.getByRole("listitem")).toHaveCount(1);
  await expect(upcoming.getByRole("listitem")).toHaveCount(48);
  await expect(tba.getByRole("listitem")).toHaveCount(2);
  await expect(out.getByRole("status")).toHaveText("49–49 of 49");
  await upcoming.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/games\/section-/);
  await page.goBack();
  await expect(upcoming.getByRole("status")).toHaveText("49–96 of 100");
  await expect(out.getByRole("status")).toHaveText("49–49 of 49");
  await upcoming.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(
    /outPage=2&upcomingPage=3&tbaPage=2&marker=keep$/,
  );
  await expect(
    page.getByRole("group", { name: "Upcoming", exact: true }),
  ).toBeFocused();
  await expect(upcoming.getByRole("listitem")).toHaveCount(4);
  await page.goBack();
  await expect(upcoming.getByRole("status")).toHaveText("49–96 of 100");
  await page.goForward();
  await page.reload();
  await expect(upcoming.getByRole("status")).toHaveText("97–100 of 100");
  await out.getByRole("button", { name: /Move .* to backlog/ }).click();
  await expect(
    page.getByRole("status", { name: "Wishlist updates" }),
  ).toContainText("Moved");
  await expect(out.getByRole("listitem")).toHaveCount(48);
  await expect(page).toHaveURL(
    /\/wishlist\?upcomingPage=3&tbaPage=2&marker=keep$/,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Wishlist updates" }),
  ).toContainText("is back on your Wishlist");
  await expect(upcoming.getByRole("status")).toHaveText("97–100 of 100");
  await out.getByRole("button", { name: "Next" }).click();
  await expect(out.getByRole("listitem")).toHaveCount(1);
  await expect(tba.getByRole("status")).toHaveText("49–50 of 50");
  const publicUrl = `/u/${username}?view=wishlist&outPage=2&upcomingPage=2&tbaPage=2&libraryPage=3&publicPlaythroughPage=2&marker=keep`;
  for (const authenticated of [true, false]) {
    const context = await browser.newContext(
      authenticated
        ? { storageState: await page.context().storageState() }
        : {},
    );
    try {
      const fresh = await context.newPage();
      await fresh.goto(authenticated ? linked : publicUrl);
      for (const [label, range, count] of [
        [/^Out now/, "49–49 of 49", 1],
        [/^Upcoming/, "49–96 of 100", 48],
        [/^Release date not announced/, "49–50 of 50", 2],
      ] as const) {
        const section = fresh.getByRole("region", { name: label });
        await expect(section.getByRole("status")).toHaveText(range);
        await expect(section.getByRole("listitem")).toHaveCount(count);
      }
      if (!authenticated) {
        await expect(
          fresh.getByRole("button", { name: /Move .* to/ }),
        ).toHaveCount(0);
        await fresh
          .getByRole("region", { name: /^Upcoming/ })
          .getByRole("button", { name: "Next" })
          .click();
        await expect(fresh).toHaveURL(
          /view=wishlist&outPage=2&upcomingPage=3&tbaPage=2&libraryPage=3&publicPlaythroughPage=2&marker=keep$/,
        );
        await fresh.goBack();
        await fresh.reload();
        await expect(
          fresh.getByRole("region", { name: /^Upcoming/ }).getByRole("status"),
        ).toHaveText("49–96 of 100");
      }
    } finally {
      await context.close();
    }
  }
  for (const value of ["wrong", "0", "-1", "1.5", "999"]) {
    await page.goto(
      `/wishlist?outPage=${value}&upcomingPage=${value}&tbaPage=${value}&marker=keep`,
    );
    await expect(out.getByRole("status")).toHaveText(
      value === "999" ? "49–49 of 49" : "1–48 of 49",
    );
    await expect(upcoming.getByRole("status")).toHaveText(
      value === "999" ? "97–100 of 100" : "1–48 of 100",
    );
    await expect(tba.getByRole("status")).toHaveText(
      value === "999" ? "49–50 of 50" : "1–48 of 50",
    );
    await expect(page).toHaveURL(
      value === "999"
        ? /outPage=2&upcomingPage=3&tbaPage=2&marker=keep$/
        : /\/wishlist\?marker=keep$/,
    );
  }
  const shrink = await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `delete from journal_entry where user_id = (select id from "user" where email = $1) and game_id >= 20145`,
      params: [email],
    },
  });
  expect(shrink.ok(), await shrink.text()).toBeTruthy();
  await page.reload();
  await expect(upcoming.getByRole("status")).toHaveText("49–96 of 96");
  await expect(tba).toHaveCount(0);
  await expect(page).toHaveURL(/outPage=2&upcomingPage=2&marker=keep$/);
  await page.setViewportSize({ width: 320, height: 740 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.fontSize = "32px";
    }, theme);
    await expect(out.getByRole("button", { name: "Previous" })).toBeVisible();
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName,
          text: el.textContent?.slice(0, 60),
          width: el.getBoundingClientRect().width,
        })),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      JSON.stringify(overflow),
    ).toBe(true);
  }
});

test("F14 Stats dataset links restore bounded personal and public rows lazily", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const username = `datasets_${testInfo.workerIndex}_${Date.now()}`;
  const email = await signUp(page, request, username);
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, genres, platforms, synced_at) values
     (30000, 'Dataset game', 'dataset-game', '{}', '{PC}', now()) on conflict (id) do nothing`,
      `insert into journal_entry (user_id, game_id, status, updated_at)
     select id, 30000, 'played', now() from "user" where email = $1`,
      `insert into playthrough (user_id, game_id, platform, started_on, ended_on, hours, notes)
     select u.id, 30000, 'Platform ' || lpad(n::text, 3, '0'),
       date '1900-01-01' + n * interval '1 year', date '1900-01-02' + n * interval '1 year',
       case when n=0 then 0 when n=1 then 1 when n=2 then 0.5 else 2 end,
       'Dataset private ' || n
     from "user" u cross join generate_series(0,99) n where u.email = $1`,
      `insert into status_event (user_id, game_id, status, at)
     select u.id, 30000, case when n % 2 = 0 then 'backlog' else 'played' end,
       timestamp '2020-01-01' + n * interval '1 day'
     from "user" u cross join generate_series(0,99) n where u.email = $1`,
    ],
    [email],
  );
  await page.goto("/stats");
  await expect(
    page.getByRole("list", { name: "games by category" }).getByRole("listitem"),
  ).toHaveCount(48);
  await expect(page.getByRole("table")).toHaveCount(0);
  const linked = "/stats?finishedPage=2&hoursPage=2&backlogPage=2&marker=keep";
  await page.goto(linked);
  for (const name of [
    "games by category",
    "hours by category",
    "Backlog data",
  ]) {
    await expect(
      page
        .getByRole("navigation", { name: `${name} pages` })
        .getByRole("status"),
    ).toHaveText("49–96 of 100");
  }
  await expect(page.getByRole("row")).toHaveCount(49);
  await expect(page.getByRole("row").nth(1)).toContainText("2020-02-18");
  const hoursPages = page.getByRole("navigation", {
    name: "hours by category pages",
  });
  await hoursPages.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(
    /finishedPage=2&hoursPage=3&backlogPage=2&marker=keep$/,
  );
  await expect(
    page.getByRole("group", { name: "hours by category", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("list", { name: "hours by category" }).getByRole("listitem"),
  ).toHaveCount(4);
  await page.goBack();
  await expect(hoursPages.getByRole("status")).toHaveText("49–96 of 100");
  await page.goForward();
  await page.reload();
  await expect(hoursPages.getByRole("status")).toHaveText("97–100 of 100");
  for (const key of ["finishedPage", "backlogPage"]) {
    const label =
      key === "finishedPage" ? "games by category pages" : "Backlog data pages";
    await page
      .getByRole("navigation", { name: label })
      .getByRole("button", { name: "Next" })
      .click();
    await expect(page).toHaveURL(new RegExp(`${key}=3`));
  }
  await expect(page.getByRole("row")).toHaveCount(5);
  const disclosure = page
    .getByText("View backlog data", { exact: true })
    .filter({ visible: true });
  await disclosure.focus();
  await disclosure.press("Enter");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/backlogPage=2/);
  await expect(page.getByRole("row")).toHaveCount(49);
  await page.goForward();
  await expect(page.getByRole("row")).toHaveCount(5);
  const finalUrl = page.url();
  for (const authenticated of [true, false]) {
    const context = await browser.newContext(
      authenticated
        ? { storageState: await page.context().storageState() }
        : {},
    );
    try {
      const fresh = await context.newPage();
      const payloads: Promise<string>[] = [];
      fresh.on("response", (r) => {
        if (r.url().includes(`/u/${username}`))
          payloads.push(r.text().catch(() => ""));
      });
      await fresh.goto(
        authenticated
          ? finalUrl
          : `/u/${username}?view=stats&finishedPage=3&hoursPage=3&backlogPage=3&marker=keep`,
      );
      await expect(fresh.getByRole("row")).toHaveCount(5);
      await expect(fresh.getByRole("row").nth(1)).toContainText("2020-04-06");
      for (const name of ["games by category", "hours by category"])
        await expect(
          fresh.getByRole("list", { name }).getByRole("listitem"),
        ).toHaveCount(4);
      // F12: both owner and visitor read singular, zero, plural and fractional totals.
      const hours = fresh.getByRole("list", { name: "hours by category" });
      for (const label of ["0 hours", "0.5 hours", "1 hour", "2 hours"])
        await expect(hours.getByText(label, { exact: true })).toBeVisible();
      const finished = fresh.getByRole("list", { name: "games by category" });
      await expect(finished.getByText("1 game", { exact: true })).toHaveCount(
        4,
      );
      await fresh.reload();
      await expect(fresh.getByRole("row")).toHaveCount(5);
      await fresh
        .getByRole("navigation", { name: "Backlog data pages" })
        .getByRole("button", { name: "Previous" })
        .click();
      await expect(fresh).toHaveURL(/backlogPage=2/);
      await fresh.goBack();
      await expect(fresh.getByRole("row")).toHaveCount(5);
      if (!authenticated) {
        await expect(
          fresh.getByRole("button", { name: "Stats", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        const payload = (await Promise.all(payloads)).join("\n");
        expect(payload).not.toContain("Dataset private");
        expect(payload).not.toContain(email);
        expect(payload).not.toContain("calendarToken");
        await fresh
          .getByRole("button", { name: "Library", exact: true })
          .click();
        await expect(fresh).toHaveURL(
          /view=library&finishedPage=3&hoursPage=3&backlogPage=3&marker=keep$/,
        );
        await fresh.goBack();
        await expect(fresh.getByRole("row")).toHaveCount(5);
      }
    } finally {
      await context.close();
    }
  }
  for (const value of ["nope", "0", "-1", "1.5", "999"]) {
    await page.goto(
      `/stats?finishedPage=${value}&hoursPage=${value}&backlogPage=${value}&marker=keep`,
    );
    for (const name of [
      "games by category",
      "hours by category",
      "Backlog data",
    ]) {
      await expect(
        page
          .getByRole("navigation", { name: `${name} pages` })
          .getByRole("status"),
      ).toHaveText(value === "999" ? "97–100 of 100" : "1–48 of 100");
    }
    await expect(page).toHaveURL(
      value === "999"
        ? /finishedPage=3&hoursPage=3&backlogPage=3&marker=keep$/
        : /\/stats\?marker=keep$/,
    );
  }
  const shrink = await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `delete from playthrough where user_id = (select id from "user" where email = $1) and started_on >= date '1996-01-01'`,
      params: [email],
    },
  });
  expect(shrink.ok(), await shrink.text()).toBeTruthy();
  const shrinkBacklog = await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `delete from status_event where user_id = (select id from "user" where email = $1) and at >= timestamp '2020-04-06'`,
      params: [email],
    },
  });
  expect(shrinkBacklog.ok(), await shrinkBacklog.text()).toBeTruthy();
  await page.reload();
  for (const name of [
    "games by category",
    "hours by category",
    "Backlog data",
  ]) {
    await expect(
      page
        .getByRole("navigation", { name: `${name} pages` })
        .getByRole("status"),
    ).toHaveText("49–96 of 96");
  }
  await expect(page).toHaveURL(
    /finishedPage=2&hoursPage=2&backlogPage=2&marker=keep$/,
  );
  for (const table of ["playthrough", "status_event"]) {
    const empty = await request.post("http://127.0.0.1:3101/query", {
      data: {
        sql: `delete from ${table} where user_id = (select id from "user" where email = $1)`,
        params: [email],
      },
    });
    expect(empty.ok(), await empty.text()).toBeTruthy();
  }
  await page.reload();
  await expect(
    page.getByText(/No finished games yet/).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/No hours logged yet/).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/No status history yet/).filter({ visible: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/stats\?marker=keep$/);
});
