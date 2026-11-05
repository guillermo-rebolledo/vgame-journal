import { expect, test } from "@playwright/test";
import { openCatalog } from "./support/catalog";
import { chooseStatus } from "./support/journal";
import { signUp, uniqueUsername } from "./support/sign-up";

for (const activation of ["click", "Enter", "Space"] as const) {
  test(`Catalog result ${activation} opens the game without saving; Back restores search`, async ({
    page,
    request,
  }) => {
    await signUp(
      page,
      request,
      uniqueUsername(`catalog_${activation.toLowerCase()}`),
    );
    await page.goto("/?q=Celeste&year=2018&platform=PC");
    const input = page.getByRole("combobox", {
      name: "Search games",
      exact: true,
    });
    const result = page
      .locator(".game-catalog-result")
      .filter({ hasText: "Celeste" })
      .first();
    await expect(result).toHaveAttribute("href", "/games/celeste");
    await expect(result.getByRole("button")).toHaveCount(0);
    if (activation === "click") await result.click();
    else {
      await input.press("ArrowDown");
      await expect(result).toBeFocused();
      await result.press(activation);
    }
    await expect(page).toHaveURL(/\/games\/celeste$/);
    expect(
      (await (await page.request.get("/api/account/export")).json()).entries,
    ).toEqual([]);
    await chooseStatus(page, "backlog");
    await page.goBack();
    await expect(input).toHaveValue("Celeste");
    await expect(input).toBeFocused();
    await expect(
      page.getByRole("combobox", { name: "Release year", exact: true }),
    ).toContainText("2018");
    await expect(
      page.getByRole("combobox", { name: "Platform", exact: true }),
    ).toContainText("PC");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("link", { name: "Backlog (1)", exact: true }),
    ).toBeVisible();
  });
}

test("Catalog result modifier click preserves search in the original tab", async ({
  page,
}) => {
  await page.goto("/");
  await (await openCatalog(page)).fill("Celeste");
  const result = page
    .locator(".game-catalog-result")
    .filter({ hasText: "Celeste" })
    .first();
  const opened = page.context().waitForEvent("page");
  await result.click({ modifiers: ["ControlOrMeta"] });
  const tab = await opened;
  await expect(tab).toHaveURL(/\/games\/celeste$/);
  await tab.close();
  await expect(
    page.getByRole("dialog", { name: "Search results" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toHaveValue("Celeste");
});

for (const theme of ["light", "dark"] as const) {
  test(`Cover-led Catalog reflows in ${theme} with keyboard focus, long metadata and enlarged text`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      theme,
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
          {
            id: 2,
            slug: "silksong",
            title:
              "A very long game title that wraps across multiple lines without hiding any of its identity",
            coverImageId: null,
            year: null,
            platforms: [
              "Super Nintendo Entertainment System",
              "Nintendo Switch",
            ],
          },
        ],
      }),
    );
    await page.goto("/?q=games");
    const input = page.getByRole("combobox", {
      name: "Search games",
      exact: true,
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator(".game-catalog-result")).toHaveCount(2);
      for (const font of [16, 32]) {
        await page.evaluate((font) => {
          document.documentElement.style.fontSize = `${font}px`;
        }, font);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        const popup = page.getByRole("dialog", { name: "Search results" });
        await expect
          .poll(
            () =>
              popup.evaluate((node) => {
                const anchor = document.querySelector(".game-catalog-input");
                if (!anchor) return false;
                // Base UI updates the anchored width after a resize observer runs.
                const positioned =
                  Math.abs(
                    node.getBoundingClientRect().width -
                      anchor.getBoundingClientRect().width,
                  ) <= 1;
                return (
                  positioned &&
                  [
                    node,
                    ...node.querySelectorAll<HTMLElement>(
                      ".game-catalog-results, .game-catalog-result",
                    ),
                  ].every(
                    (element) => element.scrollWidth <= element.clientWidth + 1,
                  )
                );
              }),
            { message: `Catalog fits at ${width}px with ${font}px root text` },
          )
          .toBe(true);
      }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "16px";
      });
      await input.press("ArrowDown");
      await expect(page.locator(".game-catalog-result").first()).toBeFocused();
      if (
        (theme === "light" && width === 390) ||
        (theme === "dark" && width === 1440)
      )
        await testInfo.attach(`catalog-${theme}-${width}`, {
          body: await page.screenshot({ fullPage: false }),
          contentType: "image/png",
        });
      await input.focus();
    }
  });
}
