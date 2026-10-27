import { expect, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";

test.use({ video: "on" });

declare global {
  interface Window {
    motionAnimations: string[];
    motionCoverWidth?: string;
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
  const texture = page.locator("[data-cover-glare] > span");
  const background = await texture.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );
  const transform = await texture.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
  await expect
    .poll(() =>
      texture.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(transform);
  await expect(texture).toHaveCSS("background-image", background);
  await page.mouse.move(0, 0);
  await expect(cover).toHaveCSS("transform", "none");
  await expect(page.locator("[data-cover-glare]")).toHaveCSS("opacity", "0");
});

test("playthrough drawer keeps the page stationary and dismisses its select first", async ({
  page,
  request,
}) => {
  await signUp(page, request, `drawer_${Date.now()}`);
  await page.goto("/games/celeste");
  await expect(page.getByLabel("Started", { exact: true })).toHaveCount(0);
  const cover = page.getByRole("heading", {
    name: "Celeste",
    includeHidden: true,
  });
  await expect(cover).toBeVisible();
  const before = await cover.boundingBox();
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Started", { exact: true })).toBeVisible();
  expect((await cover.boundingBox())?.y).toBe(before?.y);
  await page.getByRole("combobox", { name: "Platform", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCSS("translate", "none");
  await expect(
    page.getByRole("combobox", { name: "Platform", exact: true }),
  ).toBeVisible();
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
  await page.route("**/games/celeste?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("searchbox").fill("Celeste");
  const link = page.getByRole("link", { name: /Celeste/ });
  await expect(link).toBeVisible();
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
  expect(
    await page.evaluate(() => window.motionAnimations.join("\n")),
  ).toContain("route-out");
});

for (const view of ["Grid", "List"] as const) {
  test(`library ${view.toLowerCase()} cover morphs into the hero`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await signUp(page, request, `morph_${view.toLowerCase()}_${Date.now()}`);
    await page.goto("/games/celeste");
    await chooseStatus(page, "backlog");
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

    await page.goto("/library");
    await page.getByRole("button", { name: view, exact: true }).click();
    await page
      .getByRole("list", { name: "Games", exact: true })
      .getByRole("link", { name: /Celeste/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Celeste", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.motionAnimations.join("\n")))
      .toContain("game-cover-1");
  });
}

for (const source of ["search", "shelf"] as const) {
  test(`Home ${source} morph starts from the clicked cover when search overlaps a shelf`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await signUp(page, request, `overlap_${source}_${Date.now()}`);
    await page.goto("/games/celeste");
    await chooseStatus(page, "backlog");
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
    await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
    const search = page
      .getByRole("list", { name: "Search results" })
      .getByRole("link");
    await expect(search).toBeVisible();
    const shelf = page
      .getByRole("region", { name: "Recently added" })
      .getByRole("link", { name: "Celeste", exact: true });
    await expect(shelf).toBeVisible();
    const link = source === "search" ? search : shelf;
    const cover = link.locator("img");
    const width = (await cover.boundingBox())?.width;
    expect(width).toBeGreaterThan(0);
    await page.evaluate(() => {
      function sample() {
        for (const animation of document.getAnimations()) {
          if (
            animation instanceof CSSAnimation &&
            (animation.effect as KeyframeEffect).pseudoElement ===
              "::view-transition-group(game-cover-1)"
          ) {
            window.motionCoverWidth = (
              animation.effect as KeyframeEffect
            ).getKeyframes()[0].width as string;
            return;
          }
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await link.click();
    await expect(
      page.getByRole("heading", { name: "Celeste", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.motionCoverWidth))
      .toBe(`${width}px`);
  });
}

test("filtering the library never animates covers", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await signUp(page, request, `filter_motion_${Date.now()}`);
  for (const slug of ["celeste", "silksong"]) {
    await page.goto(`/games/${slug}`);
    await chooseStatus(page, "backlog");
  }
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

  await page.goto("/library");
  await page.getByLabel("Search your Library").fill("Celeste");
  await expect(page.getByText("1 of 2 games", { exact: true })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  expect(
    await page.evaluate(() => window.motionAnimations.join("\n")),
  ).not.toContain("game-cover-");
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

test("touch on a desktop with a fine primary pointer still presses the cover", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("Celeste");
  const cover = page.locator("[data-tilt-cover]");
  await expect(cover).toBeVisible();
  expect(await page.evaluate(() => matchMedia("(pointer: fine)").matches)).toBe(
    true,
  );
  const box = await cover.boundingBox();
  if (!box) throw new Error("Cover has no bounds");
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
  await expect(cover).not.toHaveCSS("transform", "none");
  await expect(page.locator("[data-cover-glare]")).toHaveCSS("opacity", "1");
  const cdp = await page.context().newCDPSession(page);
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
});
