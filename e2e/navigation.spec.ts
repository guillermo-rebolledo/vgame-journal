import { expect, type Locator, type Page, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";

/** Every visible target is at least 44 × 44 CSS px and none overlap. */
async function expectTouchTargets(targets: Locator) {
  const boxes = [];
  for (const target of await targets.all()) {
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    if (!box) continue;
    const name =
      (await target.getAttribute("aria-label")) ?? (await target.innerText());
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
    boxes.push({ name, ...box });
  }
  expect(boxes.length).toBeGreaterThan(0);
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      expect(
        a.x + a.width <= b.x + 0.5 ||
          b.x + b.width <= a.x + 0.5 ||
          a.y + a.height <= b.y + 0.5 ||
          b.y + b.height <= a.y + 0.5,
        `${a.name} overlaps ${b.name}`,
      ).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test("populated collections keep Find a game reachable with comfortable phone controls", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const signedOut = await browser.newPage({
    viewport: { width: 320, height: 640 },
  });
  await signedOut.goto("/");
  await expectNoHorizontalOverflow(signedOut);
  await expectTouchTargets(signedOut.locator("header a, header button"));
  await snap(signedOut, testInfo, "signed-out-320");
  await signedOut.close();

  const username = `nav_${Date.now()}`;
  await signUp(page, request, username);

  // Released Celeste on the wishlist offers moves; upcoming Silksong counts down.
  for (const title of ["Celeste", "Silksong"]) {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search games" }).fill(title);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await chooseStatus(page, "wishlist");
  }

  const nav = page.getByRole("navigation", { name: "Main" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/library");
    await expect(page.getByRole("list", { name: "Games" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Library" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(
      page.locator(
        "header a, header button, main select, main fieldset button",
      ),
    );
    // Account actions sit on their own row, above the collection navigation.
    const signOut = page.getByRole("button", { name: "Sign out" });
    const navBox = await nav.boundingBox();
    const signOutBox = await signOut.boundingBox();
    if (!navBox || !signOutBox) throw new Error("Header has no bounds");
    expect(signOutBox.y + signOutBox.height).toBeLessThanOrEqual(navBox.y);
  }
  await snap(page, testInfo, "library-mobile");

  await page.goto("/wishlist");
  await expect(nav.getByRole("link", { name: "Wishlist" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: /^Move Celeste/ })).toHaveCount(
    2,
  );
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(
    page.locator("header a, header button, main li button"),
  );
  await snap(page, testInfo, "wishlist-mobile");

  // Keyboard: the brand is the first stop and carries a visible focus ring.
  await page.keyboard.press("Tab");
  const brand = page.getByRole("link", { name: "shelve.games" });
  await expect(brand).toBeFocused();
  await expect(brand).not.toHaveCSS("box-shadow", "none");

  await nav.getByRole("link", { name: "Find a game" }).click();
  await expect(page).toHaveURL("/");
  await expect(nav.getByRole("link", { name: "Find a game" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("link", { name: /Celeste/ })
    .click();
  await expect(page).toHaveURL(/\/games\/celeste/);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  await brand.click();
  await expect(page).toHaveURL("/");

  for (const [name, width, height] of [
    ["library-tablet", 768, 1024],
    ["library-desktop", 1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/library");
    await expect(page.getByRole("list", { name: "Games" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await snap(page, testInfo, name);
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`F07: empty and populated Journal pages reflow with enlarged text in ${theme}`, async ({
    page,
    request,
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
    page.setDefaultTimeout(15_000);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    const username = `reflow_${Date.now()}`.padEnd(30, "x");
    const email = await signUp(page, request, username);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const nav = page.getByRole("navigation", { name: "Main", exact: true });
    const checkWidth = async (name: string, font: number, width = 320) => {
      await expect(page.locator("html")).toHaveCSS("font-size", `${font}px`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        name,
      ).toBeLessThanOrEqual(width);
      const clipped = await page
        .locator("button:visible")
        .evaluateAll((buttons) =>
          buttons
            .filter((button) => button.scrollHeight > button.clientHeight + 1)
            .map((button) => button.textContent?.trim()),
        );
      expect(clipped, `${name}: readable button labels`).toEqual([]);
    };
    const visit = async (path: string, font: number) => {
      await page.goto(path);
      await page.evaluate(
        ({ font, theme }) => {
          document.documentElement.style.fontSize = `${font}px`;
          localStorage.setItem("theme", theme);
          document.documentElement.classList.toggle("dark", theme === "dark");
        },
        { font, theme },
      );
    };
    for (const populated of [false, true]) {
      if (populated) {
        await page.goto("/games/celeste");
        await chooseStatus(page, "wishlist");
        await page.goto("/");
        await page
          .getByRole("searchbox", { name: "Search games" })
          .fill("The Lantern Keeper");
        await page
          .getByRole("list", { name: "Search results" })
          .getByRole("link")
          .click();
        await chooseStatus(page, "wishlist");
        await seedSql(
          request,
          [
            `insert into game (id, title, slug, genres, platforms, synced_at)
           select n, 'Collection game ' || n, 'reflow-' || n, '{}', '{PC}', now()
           from generate_series(21000, 21999) n on conflict (id) do nothing`,
            `insert into journal_entry (user_id, game_id, status, updated_at)
           select u.id, n, 'wishlist', now() from "user" u cross join generate_series(21000, 21999) n where u.email = $1`,
            `insert into playthrough (user_id, game_id, platform, started_on, ended_on, hours, notes)
           select u.id, 21000, 'PC', '2026-01-01', '2026-02-02', 1, 'Private reflow note'
           from "user" u cross join generate_series(1, 100) n where u.email = $1`,
          ],
          [email],
        );
      }
      for (const font of [16, 32]) {
        await page.setViewportSize({ width: 320, height: 740 });
        await visit("/", font);
        await expect(
          page.getByRole("heading", { name: "Your Journal", exact: true }),
        ).toBeVisible();
        await checkWidth(`Home ${populated} ${font}`, font);
        await page
          .getByRole("searchbox", { name: "Search games" })
          .fill("Celeste");
        await expect(
          page.getByRole("list", { name: "Search results" }).getByRole("link"),
        ).toBeVisible({ timeout: 30_000 });
        await checkWidth("Home search results", font);
        for (const name of ["Library", "Wishlist", "Stats"] as const) {
          await nav.getByRole("link", { name, exact: true }).click();
          await expect(
            page.getByRole("heading", { name, exact: true, level: 1 }),
          ).toBeVisible();
          if (name === "Library") {
            await expect(
              populated
                ? page.getByRole("list", { name: "Games", exact: true })
                : page.getByText("Your library is empty.", { exact: true }),
            ).toBeVisible();
            if (populated) {
              await page.getByLabel("Sort by").selectOption("title");
              await page
                .getByLabel("Status", { exact: true })
                .selectOption("wishlist");
              await page
                .getByRole("button", { name: "List", exact: true })
                .click();
              await checkWidth("Library list and filters", font);
              await page
                .getByRole("button", { name: "Grid", exact: true })
                .click();
              await page.getByText("More filters", { exact: true }).click();
              await page
                .getByLabel("Platform", { exact: true })
                .selectOption("PC");
              await checkWidth("Library expanded filters", font);
              await page
                .getByRole("button", { name: "Clear filters", exact: true })
                .click();
              const pages = page.getByRole("navigation", {
                name: "Library games pages",
                exact: true,
              });
              await pages
                .getByRole("button", { name: "Next", exact: true })
                .click();
              await expect(pages.getByRole("status")).toHaveText(
                "49–96 of 1002",
              );
              await checkWidth("Library pagination", font);
              await pages
                .getByRole("button", { name: "Previous", exact: true })
                .click();
              if (font === 32) {
                await page
                  .getByRole("heading", {
                    name: "Library",
                    level: 1,
                    exact: true,
                  })
                  .scrollIntoViewIfNeeded();
                await page.screenshot({
                  animations: "disabled",
                  path: testInfo.outputPath(`library-enlarged-${theme}.png`),
                });
              }
            }
          } else if (name === "Wishlist") {
            if (populated) {
              await page
                .getByRole("button", {
                  name: "Move Celeste to backlog",
                  exact: true,
                })
                .click();
              const notice = page.getByRole("status", {
                name: "Wishlist updates",
              });
              await expect(notice).toContainText("Moved Celeste");
              await notice
                .getByRole("button", { name: "Undo", exact: true })
                .click();
              await expect(notice).toContainText("Celeste is back");
            } else
              await expect(
                page.getByText("Your wishlist is empty.", { exact: true }),
              ).toBeVisible();
          } else
            await expect(
              page.getByRole("heading", {
                name: "Hours by platform",
                exact: true,
              }),
            ).toBeVisible();
          await checkWidth(`${name} ${populated} ${font}`, font);
        }
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .click();
        const feed = page.getByRole("textbox", { name: "Calendar feed URL" });
        await expect(feed).toBeVisible();
        await checkWidth(`Settings ${font}`, font);
        await feed.focus();
        await expect(feed).toBeFocused();
        await page.getByRole("button", { name: "Copy", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Copied", exact: true }),
        ).toBeVisible();
        await page.getByRole("radio", { name: /Japan/ }).check();
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByRole("radio", { name: /Japan/ })).toBeChecked();
        await page.getByRole("link", { name: username, exact: true }).click();
        await expect(
          page.getByRole("heading", { name: username, exact: true }),
        ).toBeVisible();
        for (const view of ["Library", "Wishlist", "Stats"] as const) {
          await page
            .getByRole("group", { name: "Profile views" })
            .getByRole("button", { name: view, exact: true })
            .click();
          await checkWidth(`Profile ${view} ${font}`, font);
        }
        if (font === 32 && populated)
          await page.screenshot({
            animations: "disabled",
            path: testInfo.outputPath(`profile-enlarged-${theme}.png`),
          });
      }
    }
    for (const width of [390, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await visit("/library", 16);
      await expect(
        page.getByRole("list", { name: "Games", exact: true }),
      ).toBeVisible();
      await checkWidth(`normal ${width}`, 16, width);
      if (width === 390)
        await expectTouchTargets(
          page.locator(
            "header a, header button, main select, main fieldset button",
          ),
        );
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await visit("/", 32);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Your games, remembered.",
        exact: true,
      }),
    ).toBeVisible();
    await checkWidth("Guest Home", 32);
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });
}
