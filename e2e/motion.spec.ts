import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    motionAnimations: string[];
  }
}

test("covers tilt toward the pointer and spring back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("Celeste");
  const cover = page.locator("[data-tilt-cover]");
  await expect(cover).toBeVisible();
  const box = await cover.boundingBox();
  if (!box) throw new Error("Cover has no bounds");
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
  await expect(cover).not.toHaveCSS("transform", "none");
  await expect(page.locator("[data-cover-glare]")).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await expect(cover).toHaveCSS("transform", "none");
  await expect(page.locator("[data-cover-glare]")).toHaveCSS("opacity", "0");
});

test("new search covers stagger in without replaying on pointer movement", async ({
  page,
}) => {
  await page.route("**/api/games/search?*", (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          slug: "celeste",
          title: "Celeste",
          coverImageId: "co3byy",
          platforms: [],
          year: 2018,
        },
        {
          id: 2,
          slug: "silksong",
          title: "Silksong",
          coverImageId: null,
          platforms: [],
          year: null,
        },
      ],
    }),
  );
  await page.goto("/");
  await page.getByRole("searchbox").fill("games");
  const entries = page.locator(".cover-entry");
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toHaveCSS("animation-name", "cover-in");
  await expect(entries.nth(1)).toHaveCSS("animation-delay", "0.035s");
  await expect(entries.first()).toHaveCSS("opacity", "1");
});

test("search cover morphs into the hero with a route fade and upward slide", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const observed = window;
    observed.motionAnimations = [];
    function sample() {
      for (const animation of document.getAnimations()) {
        if (animation instanceof CSSAnimation) {
          observed.motionAnimations.push(
            `${animation.animationName}:${(animation.effect as KeyframeEffect).pseudoElement}`,
          );
        }
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto("/");
  await page.getByRole("searchbox").fill("Celeste");
  const link = page.getByRole("link", { name: /Celeste/ });
  await expect(link).toBeVisible();
  // Wait for the full destination prefetch so the hero is in the navigation commit.
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("/games/celeste?")),
      ),
    )
    .toBe(true);
  await link.click();
  await expect(
    page.getByRole("heading", { name: "Celeste", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.motionAnimations.join("\n")))
    .toContain("route-in");
  expect(
    await page.evaluate(() => window.motionAnimations.join("\n")),
  ).toContain("game-cover-1");
});

test("touch presses scale covers without tilt or glare", async ({
  browser,
}) => {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("searchbox").fill("Celeste");
  const cover = page.locator("[data-tilt-cover]");
  await expect(cover).toBeVisible();
  const box = await cover.boundingBox();
  if (!box) throw new Error("Cover has no bounds");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(cover).toHaveCSS("scale", "0.96");
  await expect(cover).toHaveCSS("transform", "none");
  await expect(page.locator("[data-cover-glare]")).toHaveCSS("opacity", "0");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(cover).toHaveCSS("scale", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(cover).toHaveCSS("scale", "none");
  await expect(cover).toHaveCSS("transform", "none");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.getByRole("link", { name: /Celeste/ }).tap();
  await expect(
    page.getByRole("heading", { name: "Celeste", exact: true }),
  ).toBeVisible();
  await context.close();
});

for (const reduced of [false, true]) {
  test(`navigation works with ${reduced ? "reduced motion and no cover transforms" : "View Transitions unavailable"}`, async ({
    page,
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    else
      await page.addInitScript(() => {
        Object.defineProperty(document, "startViewTransition", {
          value: undefined,
        });
      });
    await page.goto("/");
    await page.getByRole("searchbox").fill("Celeste");
    const cover = page.locator("[data-tilt-cover]");
    await expect(cover).toBeVisible();
    if (reduced) {
      await cover.hover();
      await expect(cover).toHaveCSS("transform", "none");
      await expect(page.locator(".cover-entry")).toHaveCSS(
        "animation-name",
        "none",
      );
      await expect(page.locator("[data-cover-glare]")).toBeHidden();
    }
    await page.getByRole("link", { name: /Celeste/ }).click();
    await expect(
      page.getByRole("heading", { name: "Celeste", exact: true }),
    ).toBeVisible();
    if (reduced)
      expect(
        await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation instanceof CSSAnimation &&
                  /route-|view-transition/.test(animation.animationName),
              ).length,
        ),
      ).toBe(0);
    await page.goBack();
    await expect(page.getByRole("searchbox")).toBeVisible();
  });
}
