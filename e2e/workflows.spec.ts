import { expect, type Page, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";

// The fake GameSource's "today" game is dated by the UTC day.
test.use({ timezoneId: "UTC" });
// Sign-ups may wait out the auth rate limit.
test.describe.configure({ timeout: 90_000 });

const LONG_TITLE =
  "The Lantern Keeper's Extraordinarily Long Voyage Across the Shattered Archipelago: Definitive Edition";

async function wishlist(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search games" }).fill(title);
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("link", { name: new RegExp(title.slice(0, 20)) })
    .click();
  await chooseStatus(page, "wishlist");
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test("Home guides new users, and search survives slow, stale and failed requests", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "How your Journal starts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign up to start a Journal" }),
  ).toHaveAttribute("href", "/sign-up");
  await expect(
    page.getByRole("searchbox", { name: "Search games" }),
  ).toBeVisible();
  await snap(page, testInfo, "home-signed-out", true);

  // Hold the first response until a newer query wins; no timing sleeps.
  let releaseStale!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseStale = resolve;
  });
  let started!: () => void;
  const staleRequested = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finished!: () => void;
  const staleFinished = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route("**/api/games/search?q=ce", async (route) => {
    started();
    await held;
    await route.fulfill({
      json: [
        {
          id: 99,
          slug: "stale",
          title: "Stale result",
          coverImageId: null,
          platforms: [],
          year: null,
        },
      ],
    });
    finished();
  });
  const box = page.getByRole("searchbox", { name: "Search games" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const catalogQueries: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/games/search?"))
      catalogQueries.push(new URL(request.url()).searchParams.get("q") ?? "");
  });
  await expect(page.locator("output[aria-live=polite]")).toBeEmpty();
  await box.fill("   ");
  await expect(page.locator("output[aria-live=polite]")).toBeEmpty();
  await box.fill(" c ");
  await expect(page.getByRole("status")).toHaveText(
    "Enter at least 2 characters",
  );
  await expect(page.getByRole("list", { name: "Search results" })).toHaveCount(
    0,
  );

  await box.fill("ce");
  await expect(page.getByRole("status")).toHaveText("Searching…");
  await staleRequested;
  await box.fill("c");
  await expect(page.getByRole("status")).toHaveText(
    "Enter at least 2 characters",
  );
  await expect(page.getByRole("list", { name: "Search results" })).toHaveCount(
    0,
  );
  await box.fill("celeste");
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("link", { name: /Celeste/ })).toBeVisible();
  releaseStale();
  await staleFinished;
  await expect(page.getByText("Stale result")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("1 match for “celeste”.");
  await box.fill("c");
  await expect(page.getByRole("status")).toHaveText(
    "Enter at least 2 characters",
  );
  await expect(results).toHaveCount(0);

  await box.fill("nothing like this");
  await expect(page.getByRole("status")).toContainText(
    "We couldn’t find a match for “nothing like this”.",
  );
  await snap(page, testInfo, "search-no-results");

  await page.route("**/api/games/search?q=hollow", (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
  await box.fill("hollow");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Search isn’t working right now.",
  );
  await snap(page, testInfo, "search-failed");
  await box.fill("h");
  await expect(page.getByRole("status")).toHaveText(
    "Enter at least 2 characters",
  );
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await box.fill("hollow");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();

  await page.unroute("**/api/games/search?q=hollow");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status")).toContainText(
    "We couldn’t find a match",
  );
  await expect(box).toHaveValue("hollow");
  await box.fill("h");
  await expect(page.getByRole("status")).toHaveText(
    "Enter at least 2 characters",
  );
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  for (const theme of ["light", "dark"]) {
    if (!(await page.locator("html").getAttribute("class"))?.includes(theme))
      await page.getByRole("button", { name: "Toggle theme" }).click();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole("status")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
  expect(catalogQueries.length).toBeGreaterThan(0);
  expect(catalogQueries.every((query) => query.trim().length >= 2)).toBe(true);
  await box.clear();
  await expect(page.locator("output[aria-live=polite]")).toBeEmpty();
});

test("Search filters keep keyboard focus and long platform names readable at 320 pixels", async ({
  page,
}) => {
  const longPlatform = "長".repeat(100);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route("**/api/games/search?q=platforms", (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          slug: "platform-test",
          title: "Platform test",
          coverImageId: null,
          platforms: [
            "PC",
            "Super Nintendo Entertainment System",
            longPlatform,
          ],
          year: 2024,
        },
        {
          id: 2,
          slug: "platform-unknown",
          title: "Unknown platform",
          coverImageId: null,
          platforms: [],
          year: null,
        },
      ],
    }),
  );
  await page.goto("/?q=platforms");
  const platform = page.getByRole("combobox", {
    name: "Platform",
    exact: true,
  });
  await expect(platform).toBeAttached();
  await page.getByRole("searchbox", { name: "Search games" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Release year")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(platform).toBeFocused();
  await platform.selectOption("PC");
  await expect(platform).toHaveValue("PC");
  await platform.selectOption(longPlatform);
  const visibleValue = platform
    .locator("..")
    .locator('[aria-hidden="true"] span');
  await expect(visibleValue).toHaveText(longPlatform);
  expect(
    await visibleValue.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await expect(page.getByRole("link", { name: /Platform test/ })).toContainText(
    `${longPlatform}+2 platforms`,
  );
  const controlBounds = await platform.boundingBox();
  const clearBounds = await page
    .getByRole("button", { name: "Clear filters" })
    .boundingBox();
  expect(controlBounds?.width).toBeGreaterThan(250);
  expect(clearBounds?.y).toBeGreaterThanOrEqual(
    (controlBounds?.y ?? 0) + (controlBounds?.height ?? 0),
  );
  await expectNoHorizontalOverflow(page);
  await page.locator("html").evaluate((node) => {
    node.style.fontSize = "200%";
  });
  await expectNoHorizontalOverflow(page);
  await page.locator("html").evaluate((node) => {
    node.style.removeProperty("font-size");
  });
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(platform).toHaveValue("");
  await expect(page.getByRole("link", { name: /Platform test/ })).toContainText(
    "PC+2 platforms",
  );
});

test("Library search, filters and sort survive game visits, Back and reload", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, `lib_${Date.now()}`);
  await expect(page.getByText("Your Journal is empty.")).toBeVisible();
  await snap(page, testInfo, "home-empty-journal");

  for (const title of ["Celeste", "Silksong", "Moss Cartographer"])
    await wishlist(page, title);
  await chooseStatus(page, "backlog");

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Recently added" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Library (3)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wishlist (2)" })).toBeVisible();
  await snap(page, testInfo, "home-signed-in", true);

  await page.goto("/library");
  await page.getByLabel("Search your Library").fill("Celeste");
  await expect(
    page.getByRole("list", { name: "Games" }).getByRole("heading"),
  ).toHaveText(["Celeste"]);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByLabel("Search your Library")).toHaveValue("");
  await page.getByLabel("Search your Library").fill("s");
  await page.getByLabel("Status").selectOption("wishlist");
  await page.getByLabel("Sort by").selectOption("title");
  await expect(page).toHaveURL(/\/library\?q=s&status=wishlist&sort=title$/);
  const games = page.getByRole("list", { name: "Games" });
  await expect(games.getByRole("heading")).toHaveText(["Celeste", "Silksong"]);
  await expect(page.getByText("2 of 3 games")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
  await snap(page, testInfo, "library-filtered-desktop");

  await games.getByRole("link", { name: /Silksong/ }).click();
  await expect(page).toHaveURL(/\/games\/silksong/);
  await page.goBack();
  await expect(page.getByLabel("Search your Library")).toHaveValue("s");
  await expect(games.getByRole("heading")).toHaveText(["Celeste", "Silksong"]);
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("wishlist");
  await expect(page.getByLabel("Sort by")).toHaveValue("title");
  await expect(games.getByRole("heading")).toHaveText(["Celeste", "Silksong"]);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/library\?sort=title$/);
  await expect(games.getByRole("heading")).toHaveText([
    "Celeste",
    "Moss Cartographer",
    "Silksong",
  ]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Status").selectOption("backlog");
  await expectNoHorizontalOverflow(page);
  await snap(page, testInfo, "library-filtered-mobile", true);

  await page.getByLabel("Search your Library").fill("Celeste");
  await page.getByRole("button", { name: "List", exact: true }).click();
  // The nav's bare Library link starts over even when Next retains this page.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Library" })
    .click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByLabel("Status")).toHaveValue("");
  await expect(page.getByLabel("Search your Library")).toHaveValue("");
  await expect(page.getByLabel("Sort by")).toHaveValue("added");
  await expect(
    page.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(games.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("3 games", { exact: true })).toBeVisible();
});

test("Wishlist sections released, upcoming and unannounced games, and moves are undoable and retryable", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, `wish_${Date.now()}`);
  for (const title of [
    "Celeste",
    "Silksong",
    "Tidewater Rangers",
    "Moss Cartographer",
    LONG_TITLE,
  ])
    await wishlist(page, title);

  await page.goto("/wishlist");
  await expect(
    page.getByText("5 games", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  const section = (name: RegExp) => page.getByRole("region", { name });
  await expect(
    section(/^Out now/).getByRole("heading", { level: 3 }),
  ).toHaveText(["Celeste"]);
  await expect(
    section(/^Upcoming/).getByRole("heading", { level: 3 }),
  ).toHaveText([LONG_TITLE, "Silksong", "Tidewater Rangers"]);
  await expect(
    section(/^Upcoming/)
      .getByText("Today!")
      .last(),
  ).toBeVisible();
  await expect(
    section(/^Release date not announced/).getByRole("heading", { level: 3 }),
  ).toHaveText(["Moss Cartographer"]);
  await snap(page, testInfo, "wishlist-desktop", true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  const long = page.getByRole("heading", { name: LONG_TITLE });
  expect((await long.boundingBox())?.height).toBeGreaterThan(30);
  await snap(page, testInfo, "wishlist-mobile", true);
  await page.setViewportSize({ width: 1280, height: 900 });

  // A failed move stays put with a local error and retries.
  const failMoves = (route: import("@playwright/test").Route) =>
    route.request().method() === "POST" ? route.abort() : route.continue();
  await page.route("**/wishlist", failMoves);
  await page.getByRole("button", { name: "Move Celeste to backlog" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Celeste" });
  await expect(row.getByRole("alert")).toContainText(
    "Couldn’t move Celeste to Backlog.",
  );
  await snap(page, testInfo, "wishlist-move-failed");
  await page.unroute("**/wishlist", failMoves);
  await row.getByRole("button", { name: "Try again" }).click();

  const notice = page.getByRole("status", { name: "Wishlist updates" });
  await expect(notice).toContainText("Moved Celeste to Backlog.");
  await expect(section(/^Out now/)).toHaveCount(0);
  await expect(
    page.getByText("4 games", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await snap(page, testInfo, "wishlist-moved");

  await notice.getByRole("button", { name: "Undo" }).click();
  await expect(notice).toContainText("Celeste is back on your Wishlist.");
  await expect(
    section(/^Out now/).getByRole("heading", { name: "Celeste" }),
  ).toBeVisible();

  // Undo after a later change elsewhere leaves that change alone.
  await page.getByRole("button", { name: "Move Celeste to playing" }).click();
  await expect(notice).toContainText("Moved Celeste to Playing.");
  const other = await page.context().newPage();
  await other.goto("/games/celeste");
  await chooseStatus(other, "backlog");
  await other.close();
  await notice.getByRole("button", { name: "Undo" }).click();
  await expect(notice.getByRole("alert")).toContainText(
    "Celeste changed after the move, so it was left as is.",
  );

  await page.goto("/library?status=backlog");
  await expect(
    page.getByRole("list", { name: "Games" }).getByRole("heading"),
  ).toHaveText(["Celeste"]);
});
