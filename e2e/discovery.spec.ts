import { expect, test } from "@playwright/test";
import {
  closeCatalog,
  openCatalog,
  selectCatalogGame,
} from "./support/catalog";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp } from "./support/sign-up";
import { supportUrl } from "./support/url";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    discovery: { recent: 4, popular: 4 },
  });
});

test("guests see discovery after search, with dates below tiles, keyboard links and responsive grids", async ({
  page,
}) => {
  await page.goto("/");
  const recent = page.getByRole("region", {
    name: "Recently released",
    exact: true,
  });
  const popular = page.getByRole("region", {
    name: "Recently trending",
    exact: true,
  });
  await expect(recent.getByRole("link")).toHaveCount(4);
  await expect(popular.getByRole("link")).toHaveCount(4);
  await expect(page.getByText(/Type at least 2 characters/)).toHaveCount(0);
  await expect(page.getByText(/Based on IGDB page visits/)).toHaveCount(0);
  for (const shelf of [recent, popular]) {
    await expect(shelf.locator("time")).toBeVisible();
    expect(
      await shelf.locator("ul").evaluate((tiles) => {
        const date = tiles.parentElement?.querySelector("time");
        return (
          date &&
          tiles.getBoundingClientRect().bottom <=
            date.getBoundingClientRect().top
        );
      }),
    ).toBe(true);
  }
  await expect(recent.locator("time")).toHaveAttribute("datetime", /T/);
  const recentHandle = await recent.elementHandle();
  if (!recentHandle) throw new Error("Recently released shelf is missing");
  expect(
    await page
      .getByRole("button", { name: "Search games…", exact: true })
      .evaluate((node, shelf) => {
        return Boolean(
          node.compareDocumentPosition(shelf) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }, recentHandle),
  ).toBe(true);
  const headings = await page
    .getByRole("heading", { level: 2 })
    .allTextContents();
  expect(headings).toEqual(["Recently released", "Recently trending"]);
  const columns = () =>
    recent
      .locator("ul")
      .evaluate(
        (node) => getComputedStyle(node).gridTemplateColumns.split(" ").length,
      );
  expect(await columns()).toBe(4);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await columns()).toBe(2);
  await page
    .getByRole("button", { name: "Search games…", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Sign up to start a Journal" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Sign in to your Journal" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(recent.getByRole("link").first()).toBeFocused();
  expect(
    await recent
      .getByRole("link")
      .first()
      .evaluate((node) => node.matches(":focus-visible")),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/games\/discovery-one$/);
  await expect(
    page.getByRole("heading", { name: "Discovery One", exact: true }),
  ).toBeVisible();
});

test("empty and saved Journals retain priority; duplicate covers navigate from each occurrence", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signUp(page, request, `discovery_${Date.now()}`);
  await expect(page.getByText(/Your Journal is empty/)).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Recently released",
        exact: true,
        includeHidden: true,
      })
      .filter({ visible: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Recently trending", exact: true })
    .getByRole("link", { name: "Discovery One", exact: true })
    .click();
  await chooseStatus(page, "playing");
  await page.goto("/games/discovery-two");
  await chooseStatus(page, "backlog");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Playing",
    "Recently added",
    "Recently released",
    "Recently trending",
  ]);
  const library = page.getByRole("link", {
    name: "All saved games (2)",
    exact: true,
  });
  await expect(library).toBeVisible();
  const personal = page.getByRole("region", {
    name: "Playing",
    exact: true,
    includeHidden: true,
  });
  await personal.getByRole("link", { name: /Discovery One/ }).click();
  await expect(page).toHaveURL(/\/games\/discovery-one$/);
  await page.goto("/");
  await selectCatalogGame(page, "Discovery One");
  await page
    .getByRole("link", { name: "View game: Discovery One", exact: true })
    .click();
  await expect(page).toHaveURL(/\/games\/discovery-one$/);
  // The Command action and all four shelf occurrences navigate independently.
  await page.goto("/");
  const links = page.getByRole("link", { name: /^Discovery One/ });
  await expect(links).toHaveCount(4);
  for (const index of [0, 1, 2, 3]) {
    await links.nth(index).click();
    await expect(page).toHaveURL(/\/games\/discovery-one$/);
    await page.goto("/");
  }
  expect(
    errors.filter((message) => /transition|duplicate/i.test(message)),
  ).toEqual([]);
});

test("pending and failed discovery leave search and personal shelves usable", async ({
  page,
  request,
}) => {
  await signUp(page, request, `discfail_${Date.now()}`);
  await page.goto("/games/discovery-one");
  await chooseStatus(page, "playing");
  await request.post(supportUrl("/discovery-state"), {
    data: { hold: true },
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ visible: true })
        .filter({ hasText: "Loading discovery picks…" }),
    ).toBeVisible();
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("font-size");
    });
    if (viewport) await page.setViewportSize(viewport);
    await expect(
      page.getByRole("region", {
        name: "Playing",
        exact: true,
        includeHidden: true,
      }),
    ).toBeVisible();
    await (await openCatalog(page)).fill("Celeste");
    await expect(page.getByRole("option", { name: /^Celeste/ })).toBeVisible();
    await expect(
      page
        .getByRole("region", {
          name: "Recently released",
          exact: true,
          includeHidden: true,
        })
        .filter({ visible: true }),
    ).toHaveCount(0);
    await request.post(supportUrl("/discovery-state"), {
      data: { hold: false },
    });
    await expect(
      page
        .getByRole("region", {
          name: "Recently released",
          exact: true,
          includeHidden: true,
        })
        .filter({ visible: true }),
    ).toBeVisible();
    await request.post(supportUrl("/discovery-state"), {
      data: { fail: true },
    });
    await page.goto("/?q=Celeste&year=2018&platform=PC&all=1&filters=1");
    await expect(
      page.getByRole("region", {
        name: "Playing",
        exact: true,
        includeHidden: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", {
          name: "Recently released",
          exact: true,
          includeHidden: true,
        })
        .filter({ visible: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ visible: true })
        .filter({ hasText: "Discovery is unavailable." }),
    ).toBeVisible();
    await (await openCatalog(page)).fill("Celeste");
    const location = page.url();
    await request.post(supportUrl("/discovery-state"), {
      data: { fail: false, hold: true },
    });
    await closeCatalog(page);
    await page
      .getByRole("button", { name: "Retry discovery", includeHidden: true })
      .filter({ visible: true })
      .click();
    await openCatalog(page);
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ visible: true })
        .filter({ hasText: "Retrying discovery…" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("button", {
          name: "Retry discovery",
          includeHidden: true,
        })
        .filter({ visible: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Search games", exact: true }),
    ).toHaveValue("Celeste");
    await request.post(supportUrl("/discovery-state"), {
      data: { hold: false },
    });
    await expect(
      page.getByRole("button", {
        name: "Retry discovery",
        includeHidden: true,
      }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("region", {
          name: "Recently released",
          exact: true,
          includeHidden: true,
        })
        .filter({ visible: true })
        .getByRole("link"),
    ).toHaveCount(4);
    await expect(page).toHaveURL(location);
    await expect(
      page.getByRole("combobox", { name: "Search games", exact: true }),
    ).toHaveValue("Celeste");
    await expect(
      page.getByRole("combobox", { name: "Search games", exact: true }),
    ).toHaveAccessibleName("Search games");
    await expect(
      page.getByRole("combobox", { name: "Release year" }),
    ).toHaveAccessibleName("Release year");
    await expect(
      page.getByRole("combobox", { name: "Platform", exact: true }),
    ).toHaveAccessibleName("Platform");
    await selectCatalogGame(page, "Celeste");
    await page
      .getByRole("link", { name: "View game: Celeste", exact: true })
      .click();
    await expect(page).toHaveURL(/\/games\/celeste$/);
  } finally {
    await request.post(supportUrl("/discovery-state"), {
      data: { fail: false, hold: false },
    });
  }
});

test("successful empty discovery offers search without an error or retry loop", async ({
  page,
  request,
}) => {
  const original = await request.post(supportUrl("/query"), {
    data: { sql: "select key, game_ids from discovery_snapshot", params: [] },
  });
  expect(original.ok()).toBe(true);
  const { rows }: { rows: [string, number[]][] } = await original.json();
  await seedSql(
    request,
    ["update discovery_snapshot set game_ids = '{}'::integer[]"],
    [],
  );
  try {
    await page.goto("/?q=Celeste");
    await expect(
      page.getByText("No discovery picks yet—search for a game."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Retry discovery",
        includeHidden: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Search games", exact: true }),
    ).toHaveValue("Celeste");
    await expect(page.getByRole("option", { name: /^Celeste/ })).toBeVisible();
  } finally {
    // Cron's refresh lease can skip an immediate retry; restore the fixture exactly.
    for (const [key, gameIds] of rows)
      await seedSql(
        request,
        [
          "update discovery_snapshot set game_ids = array(select jsonb_array_elements_text($1::jsonb)::integer) where key = $2",
        ],
        [JSON.stringify(gameIds), key],
      );
  }
});
