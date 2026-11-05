import { expect, type Locator, type Page, test } from "@playwright/test";
import { closeCatalog, openCatalog, viewCatalogGame } from "./support/catalog";
import { chooseAccountMenuItem } from "./support/header";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";
import { snap } from "./support/snap";

async function expectForcedColorsFocus(target: Locator) {
  await expect(target).toBeFocused();

  const indicator = await target.evaluate((node) => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const systemColor = (color: string) => {
      probe.style.color = color;
      return getComputedStyle(probe).color;
    };
    const palette = [systemColor("CanvasText"), systemColor("Highlight")];
    const canvas = systemColor("Canvas");
    probe.remove();
    const style = getComputedStyle(node.closest(".game-catalog-input") ?? node);
    return {
      width: parseFloat(style.outlineWidth),
      style: style.outlineStyle,
      color: style.outlineColor,
      palette,
      canvas,
    };
  });
  expect(indicator.width).toBeGreaterThanOrEqual(2);
  expect(indicator.style).toBe("solid");
  expect(indicator.palette).toContain(indicator.color);
  expect(indicator.color).not.toBe(indicator.canvas);
  await expect(target).toBeInViewport();
}

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

for (const destination of ["Library", "Wishlist"] as const) {
  test(`Find a game from ${destination} returns focus to its initiating navigation link`, async ({
    page,
    request,
  }) => {
    await signUp(
      page,
      request,
      uniqueUsername(`find_${destination.toLowerCase()}`),
    );
    const nav = page.getByRole("navigation", { name: "Main", exact: true });
    const find = nav.getByRole("link", { name: "Find a game", exact: true });
    // Exercise a fresh Home mount as well as the retained Home navigation path.
    await page.goto(`/${destination.toLowerCase()}`);
    for (const dismiss of ["close", "escape"] as const) {
      await find.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("combobox", { name: "Search games", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("combobox", { name: "Search games", exact: true })
        .fill("Celeste");
      await expect(page.getByRole("link", { name: /^Celeste/ })).toBeVisible();
      if (dismiss === "close") await closeCatalog(page);
      else await page.keyboard.press("Escape");
      await expect(find).toBeFocused();
      await nav.getByRole("link", { name: destination, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: destination, exact: true, level: 1 }),
      ).toBeVisible();
    }
  });
}

test("Find a game preserves native modifier and middle-click navigation", async ({
  page,
  request,
  context,
}) => {
  await signUp(page, request, uniqueUsername(`find_native`));
  const nav = page.getByRole("navigation", { name: "Main", exact: true });
  for (const path of ["/", "/library"]) {
    await page.goto(path);
    const find = nav.getByRole("link", { name: "Find a game", exact: true });
    for (const options of [
      { modifiers: ["ControlOrMeta" as const] },
      { button: "middle" as const },
    ]) {
      const opened = context.waitForEvent("page");
      await find.click(options);
      const tab = await opened;
      await expect(tab).toHaveURL(/\/\?search=1$/);
      await expect(
        tab.getByRole("dialog", { name: "Search results", exact: true }),
      ).toBeVisible();
      await tab.close();
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/" : path}$`));
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  }
});

test("skip route moves focus into main on Home and details", async ({
  page,
}) => {
  for (const path of ["/", "/games/celeste"]) {
    await page.goto(path);
    // Main can still be an empty streamed fallback after navigation commits.
    await expect(
      path === "/"
        ? page.getByRole("combobox", { name: "Search games", exact: true })
        : page.getByRole("link", {
            name: "Add to Journal for Celeste",
            exact: true,
          }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("main")
        .evaluate((main) => main.contains(document.activeElement)),
    ).toBe(true);
    if (path === "/")
      await expect(
        page.getByRole("combobox", { name: "Search games", exact: true }),
      ).toBeFocused();
  }
});

test("header forward and reverse keyboard order matches visible rows at every breakpoint", async ({
  page,
  request,
}) => {
  const username = uniqueUsername(`header`);
  await signUp(page, request, username);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const header = page.locator("header");
    const targets = [
      header.getByRole("link", { name: "shelve.games", exact: true }),
      ...["Find a game", "Library", "Wishlist", "Lists", "Stats"].map((name) =>
        header.getByRole("link", { name, exact: true }),
      ),
      header.getByRole("button", {
        name: `Account menu, @${username}`,
        exact: true,
      }),
    ];
    // The request-scoped account/navigation header streams after the brand.
    for (const target of targets) await expect(target).toBeVisible();
    const headerBox = await header.boundingBox();
    const accountBox = await targets[targets.length - 1].boundingBox();
    if (!headerBox || !accountBox) throw new Error("Header has no bounds");
    expect(accountBox.x + accountBox.width).toBe(
      headerBox.x + headerBox.width - 16,
    );
    await page.getByRole("link", { name: "Skip to main content" }).focus();
    let previous: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null;
    for (const target of targets) {
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
      const box = await target.boundingBox();
      if (!box) throw new Error("Header control has no bounds");
      if (previous)
        expect(
          box.y >= previous.y + previous.height - 1 ||
            box.x >= previous.x + previous.width - 1,
        ).toBe(true);
      previous = box;
    }
    for (const target of targets.slice(0, -1).reverse()) {
      await page.keyboard.press("Shift+Tab");
      await expect(target).toBeFocused();
    }
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("link", { name: "Skip to main content" }),
    ).toBeFocused();
    await expectNoHorizontalOverflow(page);
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`Catalog result links have contrasting keyboard focus in ${colorScheme} and forced colors`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      colorScheme,
    );
    await page.route("**/api/games/search?**", (route) =>
      route.fulfill({
        json: [
          {
            id: 1,
            slug: "celeste",
            title: "Celeste",
            coverImageId: null,
            year: 2018,
            platforms: ["PC", "Nintendo Switch"],
          },
        ],
      }),
    );
    await page.goto("/?q=Celeste");
    const more = page.getByRole("link", { name: /^Celeste/ });
    await expect(more).toBeVisible();
    await page
      .getByRole("combobox", { name: "Search games", exact: true })
      .press("ArrowDown");
    await expect(more).toBeFocused();
    const indicator = await more.evaluate((node) => {
      const style = getComputedStyle(node);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      const ancestors = [];
      for (
        let ancestor: Element | null = node;
        ancestor;
        ancestor = ancestor.parentElement
      )
        ancestors.unshift(ancestor);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 1, 1);
      for (const ancestor of ancestors) {
        ctx.fillStyle = getComputedStyle(ancestor).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
      }
      const luminance = () => {
        const channels = Array.from(ctx.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((value) => {
            const c = value / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const background = luminance();
      ctx.fillStyle = style.outlineColor;
      ctx.fillRect(0, 0, 1, 1);
      const foreground = luminance();
      return {
        ratio:
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        offset: parseFloat(style.outlineOffset),
      };
    });
    expect(indicator.width).toBeGreaterThanOrEqual(2);
    expect(indicator.style).toBe("solid");
    expect(indicator.offset).toBeLessThanOrEqual(-2);
    expect(indicator.ratio).toBeGreaterThanOrEqual(3);
    await page.emulateMedia({ forcedColors: "active", colorScheme });
    await expectForcedColorsFocus(more);
  });

  test(`Home keyboard controls retain visible focus in forced colors with ${colorScheme} appearance`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ forcedColors: "active", colorScheme });
    await page.route("**/api/games/search?**", (route) =>
      route.fulfill({
        json: [
          {
            id: 1,
            slug: "celeste",
            title: "Celeste",
            coverImageId: null,
            year: 2018,
            platforms: ["PC", "Nintendo Switch"],
          },
          {
            id: 2,
            slug: "silksong",
            title: "Silksong",
            coverImageId: null,
            year: 2026,
            platforms: ["PC"],
          },
        ],
      }),
    );
    await page.goto("/?q=focus");
    const input = page.getByRole("combobox", {
      name: "Search games",
      exact: true,
    });
    await expectForcedColorsFocus(input);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expectForcedColorsFocus(
      page.getByRole("combobox", { name: "Platform", exact: true }),
    );
    await page.keyboard.press("Tab");
    await expectForcedColorsFocus(
      page.getByRole("combobox", { name: "Release year", exact: true }),
    );
    await input.click();
    await expect(page.locator(".game-catalog-result").first()).toBeVisible();
    await input.press("ArrowDown");
    await expectForcedColorsFocus(page.locator(".game-catalog-result").first());
  });
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

  const username = uniqueUsername(`nav`);
  await signUp(page, request, username);

  // Released Celeste on the wishlist offers moves; upcoming Silksong counts down.
  for (const title of ["Celeste", "Silksong"]) {
    await page.goto("/");
    await viewCatalogGame(page, title);
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
    // The account trigger sits at the right edge beside collection navigation.
    const account = page.getByRole("button", { name: /^Account menu/ });
    const navBox = await nav.boundingBox();
    const accountBox = await account.boundingBox();
    if (!navBox || !accountBox) throw new Error("Header has no bounds");
    expect(accountBox.y).toBe(navBox.y);
    expect(accountBox.x).toBeGreaterThanOrEqual(navBox.x + navBox.width);
    expect(accountBox.x + accountBox.width).toBe(width - 16);
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

  // Keyboard: the skip route comes before the brand.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const brand = page.getByRole("link", { name: "shelve.games" });
  await expect(brand).toBeFocused();
  await expect(brand).not.toHaveCSS("box-shadow", "none");

  await nav.getByRole("link", { name: "Find a game" }).click();
  await expect(page).toHaveURL("/?search=1");
  await closeCatalog(page);
  await expect(nav.getByRole("link", { name: "Find a game" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await viewCatalogGame(page, "Celeste");
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
    const username = uniqueUsername(`reflow`).padEnd(30, "x");
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
        await (await openCatalog(page)).fill("The Lantern Keeper");
        await page.getByRole("link", { name: /^The Lantern Keeper/ }).click();
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
        await (await openCatalog(page)).fill("Celeste");
        await expect(
          page.locator(".game-catalog-results").getByRole("link"),
        ).toBeVisible({ timeout: 30_000 });
        await checkWidth("Home search results", font);
        await closeCatalog(page);
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
                .filter({ visible: true })
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
        await chooseAccountMenuItem(page, "Settings");
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
        await chooseAccountMenuItem(page, "My profile");
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
    await chooseAccountMenuItem(page, "Sign out");
    await expect(
      page.getByRole("heading", {
        name: "Track what you’re playing, build your backlog, and save games you want",
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
