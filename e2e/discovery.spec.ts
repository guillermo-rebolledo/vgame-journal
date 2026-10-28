import { expect, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";

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

test("guests see attributed discovery after search, with keyboard links and responsive grids", async ({
  page,
}) => {
  await page.goto("/");
  const recent = page.getByRole("region", {
    name: "Recently released",
    exact: true,
  });
  const popular = page.getByRole("region", {
    name: "Popular right now",
    exact: true,
  });
  await expect(recent.getByRole("link")).toHaveCount(4);
  await expect(popular.getByRole("link")).toHaveCount(4);
  await expect(
    recent.getByText(
      "Popular releases from the last 90 days · Based on IGDB page visits.",
    ),
  ).toBeVisible();
  await expect(
    popular.getByText("Based on IGDB page visits.", { exact: true }),
  ).toBeVisible();
  await expect(recent.locator("time")).toHaveAttribute("datetime", /T/);
  expect(
    await page
      .getByRole("searchbox", { name: "Search games" })
      .evaluate((node) => {
        const shelf = document.querySelector(
          '[aria-labelledby="home-recently-released"]',
        );
        return (
          shelf &&
          Boolean(
            node.compareDocumentPosition(shelf) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          )
        );
      }),
  ).toBe(true);
  const headings = await page
    .getByRole("heading", { level: 2 })
    .allTextContents();
  expect(headings).toEqual([
    "Recently released",
    "Popular right now",
    "How your Journal starts",
  ]);
  const columns = () =>
    recent
      .locator("ul")
      .evaluate(
        (node) => getComputedStyle(node).gridTemplateColumns.split(" ").length,
      );
  expect(await columns()).toBe(4);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await columns()).toBe(2);
  await page.getByRole("searchbox", { name: "Search games" }).focus();
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
    page.getByRole("region", { name: "Recently released", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Popular right now", exact: true })
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
    "Popular right now",
  ]);
  const library = page.getByRole("link", { name: /Library \(2\)/ });
  await expect(library).toBeVisible();
  const personal = page.getByRole("region", { name: "Playing", exact: true });
  await personal.getByRole("link", { name: /Discovery One/ }).click();
  await expect(page).toHaveURL(/\/games\/discovery-one$/);
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search games" })
    .fill("Discovery One");
  const links = page.getByRole("link", { name: /^Discovery One/ });
  await expect(links).toHaveCount(4);
  // Search and both discovery shelves share the same game, alongside Playing.
  for (const index of [0, 1, 2, 3]) {
    await links.nth(index).click();
    await expect(page).toHaveURL(/\/games\/discovery-one$/);
    await page.goto("/?q=Discovery%20One");
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
  await request.post("http://127.0.0.1:3101/discovery-state", {
    data: { hold: true },
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(
      page.getByRole("region", { name: "Playing", exact: true }),
    ).toBeVisible();
    await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
    await expect(page.getByRole("link", { name: /Celeste/ })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recently released", exact: true }),
    ).toHaveCount(0);
    await request.post("http://127.0.0.1:3101/discovery-state", {
      data: { hold: false },
    });
    await expect(
      page.getByRole("region", { name: "Recently released", exact: true }),
    ).toBeVisible();
    await request.post("http://127.0.0.1:3101/discovery-state", {
      data: { fail: true },
    });
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "Playing", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recently released", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
    await page.getByRole("link", { name: /Celeste/ }).click();
    await expect(page).toHaveURL(/\/games\/celeste$/);
  } finally {
    await request.post("http://127.0.0.1:3101/discovery-state", {
      data: { fail: false, hold: false },
    });
  }
});
