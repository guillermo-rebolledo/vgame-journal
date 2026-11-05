import { expect, type Page, test } from "@playwright/test";
import {
  closeCatalog,
  openCatalog,
  selectCatalogGame,
} from "./support/catalog";
import { expectContainedScroll } from "./support/contained-scroll";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp } from "./support/sign-up";

test.use({ video: "on" });

test("a pending Copy button stays stationary and prevents duplicate clipboard writes", async ({
  page,
  request,
}) => {
  await signUp(page, request, `copy_pending_${Date.now()}`);
  await page.goto("/settings");
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () =>
        new Promise<void>((resolve) =>
          window.addEventListener("release-clipboard", () => resolve(), {
            once: true,
          }),
        ),
    });
  });
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  const copying = page.getByRole("button", { name: "Copying…", exact: true });
  await expect(copying).toBeDisabled();
  const box = await copying.boundingBox();
  if (!box) throw new Error("Copy button has no bounds");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(copying).toHaveCSS("scale", "none");
  await page.mouse.up();
  await page.keyboard.press("Enter");
  await expect(copying).toBeDisabled();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-clipboard")),
  );
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeEnabled();
});

for (const theme of ["light", "dark"] as const) {
  test(`phone taps and dismissal remain responsive in ${theme}`, async ({
    browser,
    page,
    request,
  }, testInfo) => {
    await signUp(page, request, `phone_polish_${Date.now()}`);
    const phone = await browser.newContext({
      storageState: await page.context().storageState(),
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      colorScheme: theme,
    });
    await phone.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      theme,
    );
    const mobile = await phone.newPage();
    await mobile.goto("/games/hades--1");
    const tags = mobile.getByRole("region", {
      name: "More like Hades",
      exact: true,
    });
    const tag = tags.getByRole("button", {
      name: "Dungeon crawler",
      exact: true,
    });
    await tag.tap();
    await expect(tag).toHaveAttribute("aria-pressed", "true");
    await expect(tags.getByRole("link").first()).toHaveText("Diablo II");
    await mobile.screenshot({
      path: testInfo.outputPath(`phone-tags-${theme}.png`),
    });
    const fact = mobile.getByRole("button", { name: /^Age rating:/ });
    await fact.tap();
    await expect(fact).toHaveAttribute("aria-expanded", "true");
    await expect(mobile.getByText("Other regions")).toBeVisible();
    await expect(mobile.locator('[data-slot="hover-card-content"]')).toHaveCSS(
      "opacity",
      "1",
    );
    await mobile.screenshot({
      path: testInfo.outputPath(`phone-facts-${theme}.png`),
    });
    await mobile.getByRole("heading", { level: 1 }).tap();
    await expect(fact).toHaveAttribute("aria-expanded", "false");
    await mobile.emulateMedia({ reducedMotion: "reduce" });
    await mobile.goto("/settings");
    await mobile.evaluate(() =>
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: async () => {},
      }),
    );
    await mobile.getByRole("button", { name: "Copy", exact: true }).tap();
    const copied = mobile.getByRole("button", { name: "Copied", exact: true });
    await expect(copied).toBeVisible();
    await expect(copied.locator(".action-icon > span").first()).toHaveCSS(
      "filter",
      "none",
    );
    await expect(copied.locator(".action-icon > span").first()).toHaveCSS(
      "scale",
      "1",
    );
    await expect(copied.locator("svg").nth(1)).toHaveCSS("opacity", "1");
    await mobile.screenshot({
      path: testInfo.outputPath(`phone-copy-${theme}.png`),
    });
    await phone.close();
  });
}

test("overflowing menus, Platform choices and removal confirmations contain boundary scrolling", async ({
  page,
  request,
}) => {
  await signUp(page, request, `overlay_scroll_${Date.now()}`);
  await page.goto("/games/overlay-scroll-fixture");
  await chooseStatus(page, "played");
  await page.setViewportSize({ width: 390, height: 360 });
  const trigger = page.getByRole("button", { name: /^Change Journal status/ });
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toHaveCSS("opacity", "1");
  await expectContainedScroll(page, menu);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  const platform = page.getByRole("combobox", {
    name: "Platform",
    exact: true,
  });
  await platform.click();
  const options = page.getByRole("listbox");
  await expect(options).toBeVisible();
  const optionScroller = (await options.evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  ))
    ? options
    : page.locator('[data-slot="select-content"]');
  await expectContainedScroll(page, optionScroller);
  await page.emulateMedia({ forcedColors: "active" });
  const popup = page.locator('[data-slot="select-content"]');
  await expect(popup).toHaveCSS("border-top-width", "1px");
  await expect(popup).toHaveCSS("border-top-style", "solid");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toBeVisible();
  await expect(platform).toBeFocused();
  await page.emulateMedia({ forcedColors: "none" });
  await platform.click();
  await page.getByRole("option", { name: "PC", exact: true }).click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(0);
  await trigger.click();
  await page
    .getByRole("menuitem", { name: "Remove from journal", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 200 });
  const confirmation = page.getByRole("dialog", { name: /^Remove Overlay/ });
  await expectContainedScroll(page, confirmation);
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("popup reversals retarget continuously during entry and exit at ten percent speed", async ({
  page,
}, testInfo) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Menu", exact: true });
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const node = await menu.elementHandle();
  if (!node) throw new Error("Menu did not mount");
  const sample = () =>
    node.evaluate((el) => ({
      connected: el.isConnected,
      opacity: Number(getComputedStyle(el).opacity),
      transform: Array.from(
        new DOMMatrixReadOnly(getComputedStyle(el).transform).toFloat64Array(),
      ),
      animations: el
        .getAnimations()
        .map((animation) => animation.constructor.name),
    }));
  const expectContinuousTransform = (before: number[], after: number[]) => {
    // Scale may advance by 0.01 and translation by 1px while input is dispatched.
    for (const index of [0, 5])
      expect(Math.abs(after[index] - before[index])).toBeLessThan(0.01);
    for (const index of [12, 13])
      expect(Math.abs(after[index] - before[index])).toBeLessThan(1);
  };
  await page.waitForTimeout(100);
  const entering = await sample();
  expect(entering.opacity).toBeGreaterThan(0);
  expect(entering.opacity).toBeLessThan(1);
  expect(entering.animations).toContain("CSSTransition");
  await page.keyboard.press("Escape");
  const closing = await sample();
  expectContinuousTransform(entering.transform, closing.transform);
  expect(closing.opacity).toBeLessThan(1);
  expect(Math.abs(closing.opacity - entering.opacity)).toBeLessThan(0.2);
  await page.waitForTimeout(50);
  const exiting = await sample();
  expect(exiting.opacity).toBeLessThan(closing.opacity);
  await trigger.click({ force: true });
  const reversing = await sample();
  expectContinuousTransform(exiting.transform, reversing.transform);
  expect(reversing.connected).toBe(true);
  expect(reversing.opacity).toBeGreaterThan(0);
  expect(Math.abs(reversing.opacity - exiting.opacity)).toBeLessThan(0.2);
  await expect
    .poll(async () => (await sample()).opacity)
    .toBeGreaterThan(reversing.opacity);
  const reopened = await sample();
  expect(reopened.transform[0]).toBeGreaterThan(reversing.transform[0]);
  await expect(menu).toHaveCSS("opacity", "1");
  await expect(menu).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.screenshot({
    path: testInfo.outputPath("popup-reversal-10-percent.png"),
  });
  await testInfo.attach("popup-reversal-samples", {
    body: JSON.stringify(
      { entering, closing, exiting, reversing, reopened },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("content photos and covers have neutral inset edges in both themes", async ({
  page,
  request,
}) => {
  const username = `image_edge_${Date.now()}`;
  const email = await signUp(page, request, username);
  await seedSql(
    request,
    ['update "user" set image = $1 where email = $2'],
    ["https://images.example.test/avatar.svg", email],
  );
  await page.route(/images\.igdb\.com|images\.example\.test/, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="264" height="374"><rect width="264" height="374" fill="#888"/></svg>',
    }),
  );
  for (const theme of ["light", "dark"] as const) {
    await page.goto("/games/celeste");
    await chooseTheme(page, theme);
    const cover = page.locator('img[width="264"]');
    const avatar = page.locator('header [data-slot="avatar-image"]');
    for (const image of [cover, avatar]) {
      await expect(image).toBeVisible();
      await expect(image).toHaveCSS("outline-width", "1px");
      await expect(image).toHaveCSS("outline-offset", "-1px");
      await expect(image).toHaveCSS("outline-style", "solid");
      const pixels = await image.evaluate((el, theme) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.fillStyle = theme === "light" ? "white" : "black";
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = getComputedStyle(el).outlineColor;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      }, theme);
      // CSS color-space conversion and alpha compositing can round a channel by one byte.
      for (const channel of pixels.slice(0, 3))
        expect(
          Math.abs(channel - (theme === "light" ? 230 : 26)),
        ).toBeLessThanOrEqual(1);
      expect(pixels[3]).toBe(255);
    }
    await page.goto(`/u/${username}`);
    await expect(page.locator('main img[width="64"]')).toHaveCSS(
      "outline-offset",
      "-1px",
    );
  }
});

test("pending Journal actions stay understandable and disabled controls cannot press", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, request, `pending_motion_${Date.now()}`);
  await page.goto("/games/celeste");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/games/celeste", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  const trigger = page.getByRole("button", {
    name: "Add to Journal for Celeste",
    exact: true,
  });
  await trigger.click();
  await page
    .getByRole("menuitemradio", { name: "backlog", exact: true })
    .click();
  try {
    await expect(trigger).toHaveAttribute("aria-busy", "true");
    await expect(trigger).toHaveAttribute("aria-disabled", "true");
    await expect(trigger.locator(".lucide-loader-circle")).toHaveCSS(
      "animation-name",
      "none",
    );
    const status = page
      .getByRole("region", { name: "Game journal", exact: true })
      .getByRole("status")
      .filter({ hasText: "Saving journal status…" });
    await expect(status).toHaveText("Saving journal status…");
    await expect(
      page
        .getByRole("region", { name: "Game journal", exact: true })
        .getByText("Saving…", { exact: true }),
    ).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const button of [trigger]) {
      const box = await button.boundingBox();
      if (!box) throw new Error("Button has no bounds");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect(button).toHaveCSS("scale", "none");
      await page.mouse.up();
    }
    await expect(
      page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", {
      name: "Change Journal status for Celeste",
      exact: true,
    }),
  ).toBeEnabled();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Copy success and reset cross-fade with ${reducedMotion} motion`, async ({
    page,
    request,
    context,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signUp(page, request, `copy_motion_${Date.now()}`);
    await page.addInitScript(() => {
      window.motionCopyTransitions = [];
      function sample() {
        const button = Array.from(document.querySelectorAll("button")).find(
          (button) => button.textContent === "Copy",
        );
        const icons = button?.querySelectorAll(".action-icon > span");
        if (icons?.length === 4) {
          const frame = Array.from(icons, (icon) => {
            const style = getComputedStyle(icon);
            return {
              opacity: style.opacity,
              scale: style.scale,
              filter: style.filter,
            };
          });
          window.motionCopyFirstPaint ??= frame;
          for (const icon of icons) {
            for (const animation of icon.getAnimations()) {
              if (animation.playState === "running")
                window.motionCopyTransitions.push(animation.constructor.name);
            }
          }
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await page.goto("/settings");
    // Wait only for the first sampled paint, never for icons to settle.
    await expect
      .poll(() => page.evaluate(() => window.motionCopyFirstPaint))
      .toBeDefined();
    expect(await page.evaluate(() => window.motionCopyFirstPaint)).toEqual([
      { opacity: "1", scale: "1", filter: "none" },
      {
        opacity: "0",
        scale: reducedMotion === "reduce" ? "1" : "0.25",
        filter: reducedMotion === "reduce" ? "none" : "blur(4px)",
      },
      {
        opacity: "0",
        scale: reducedMotion === "reduce" ? "1" : "0.25",
        filter: reducedMotion === "reduce" ? "none" : "blur(4px)",
      },
      {
        opacity: "0",
        scale: reducedMotion === "reduce" ? "1" : "0.25",
        filter: reducedMotion === "reduce" ? "none" : "blur(4px)",
      },
    ]);
    expect(await page.evaluate(() => window.motionCopyTransitions)).toEqual([]);
    const copy = page.getByRole("button", { name: "Copy", exact: true });
    const icons = copy.locator(".action-icon > span");
    await expect(icons.nth(0)).toHaveCSS("opacity", "1");
    await expect(icons.nth(2)).toHaveCSS("opacity", "0");
    await expect(icons.nth(0)).toHaveCSS("transition-duration", "0.3s");
    await expect(icons.nth(0)).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.2, 0, 0, 1)",
    );
    await copy.click();
    const copied = page.getByRole("button", { name: "Copied", exact: true });
    const successIcons = copied.locator(".action-icon > span");
    await expect(successIcons.nth(0)).toHaveCSS("opacity", "0");
    await expect(successIcons.nth(2)).toHaveCSS("opacity", "1");
    await expect(successIcons.nth(0)).toHaveCSS(
      "scale",
      reducedMotion === "reduce" ? "1" : "0.25",
    );
    await expect(successIcons.nth(0)).toHaveCSS(
      "filter",
      reducedMotion === "reduce" ? "none" : "blur(4px)",
    );
    await expect(copy).toBeVisible();
    await expect(icons.nth(0)).toHaveCSS("opacity", "1");
    await expect(icons.nth(2)).toHaveCSS("opacity", "0");
  });
}

function themeStyleFlush(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const observer = new MutationObserver(() => {
          observer.disconnect();
          resolve(
            getComputedStyle(
              document.querySelector('button[type="submit"]') as Element,
            ).transitionDuration,
          );
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
      }),
  );
}

test("explicit and System Theme changes suppress transitions through the style flush", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/sign-up");
  const button = page.getByRole("button", { name: "Sign up", exact: true });
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const theme of ["light", "dark", "system"] as const) {
    const flush = themeStyleFlush(page);
    await chooseTheme(page, theme);
    expect(await flush).toBe("0s");
    await expect(button).toHaveCSS("transition-duration", "0.15s");
  }
  const flush = themeStyleFlush(page);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await flush).toBe("0s");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(button).toHaveCSS("transition-duration", "0.15s");
});

test("popup transitions retain opacity feedback and forced-colors edges", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Theme", exact: true }).hover();
  const submenu = page.getByRole("menu").filter({
    has: page.getByRole("menuitemradio", { name: "Light", exact: true }),
  });
  await expect(submenu).toBeVisible();
  await expect(submenu).toHaveCSS("animation-name", "none");
  await expect(submenu).toHaveCSS("transition-property", "opacity");
  await expect(submenu).toHaveCSS("transform", "none");
  await page.emulateMedia({ forcedColors: "active" });
  await expect(submenu).toHaveCSS("border-top-style", "solid");
  await expect(submenu).toHaveCSS("border-top-width", "1px");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.goto("/games/hades--1");
  await page.getByRole("button", { name: /^Age rating: / }).focus();
  const facts = page.locator('[data-slot="hover-card-content"]');
  await expect(facts).toBeVisible();
  await expect(facts).toHaveCSS("animation-name", "none");
  await expect(facts).toHaveCSS("transition-property", "opacity");
  await expect(facts).toHaveCSS("transform", "none");
  await expect(facts).toHaveCSS("border-top-width", "1px");
  await page.keyboard.press("Escape");
  await expect(facts).toHaveCount(0);
});

test("tooltips keep a visible edge in forced colors", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/games/hades--1");
  await page
    .getByRole("link", { name: "Add playthrough", exact: true })
    .hover();
  const tooltip = page.locator('[data-slot="tooltip-content"]');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCSS("border-top-width", "1px");
  await expect(tooltip).toHaveCSS("border-top-style", "solid");
  await expect(tooltip).toHaveCSS("transform", "none");
  expect(
    await tooltip.evaluate((el) => getComputedStyle(el).borderTopColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({
    path: testInfo.outputPath("tooltip-forced-colors.png"),
  });
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await page.emulateMedia({ forcedColors: "none" });
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByRole("link", { name: "Add playthrough", exact: true })
        .hover();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveCSS("opacity", "1");
      const box = await tooltip.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: testInfo.outputPath(`tooltip-${theme}-${width}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(tooltip).toHaveCount(0);
      await page.mouse.move(0, 0);
    }
  }
});

test("enabled buttons press to 0.96 and reduced motion stays stationary", async ({
  page,
}) => {
  await page.goto("/sign-up");
  const button = page.getByRole("button", { name: "Sign up", exact: true });
  await button.hover();
  await page.mouse.down();
  await expect(button).toHaveCSS("scale", "0.96");
  await expect(button).toHaveCSS("transition-duration", "0.15s");
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await button.hover();
  await page.mouse.down();
  await expect(button).toHaveCSS("scale", "none");
  await expect(button).toHaveCSS("translate", "none");
  await page.mouse.up();
});

declare global {
  interface Window {
    motionCopyFirstPaint?: { opacity: string; scale: string; filter: string }[];
    motionCopyTransitions: string[];
    motionAnimations: string[];
    motionCoverWidth?: string;
  }
}

test("Command result covers stay still while the pointer moves", async ({
  page,
}) => {
  await page.goto("/");
  await (await openCatalog(page)).fill("Celeste");
  const option = page.getByRole("option", { name: /^Celeste/ });
  const cover = option.locator("img");
  await expect(cover).toBeVisible();
  const before = await cover.boundingBox();
  await option.hover();
  await expect(cover).toHaveCSS("transform", "none");
  await expect(cover).toHaveCSS("animation-name", "none");
  expect(await cover.boundingBox()).toEqual(before);
  await option.click();
  await expect(
    page.getByRole("button", { name: "Back to results" }),
  ).toBeFocused();
});

test("playthrough drawer keeps the page stationary and dismisses its select first", async ({
  page,
  request,
}) => {
  await signUp(page, request, `drawer_${Date.now()}`);
  await page.goto("/games/celeste");
  await expect(page.getByLabel("Started", { exact: true })).toHaveCount(0);
  const cover = page
    .getByRole("heading", {
      name: "Celeste",
      includeHidden: true,
    })
    .filter({ visible: true });
  await expect(cover).toBeVisible();
  const add = page.getByRole("button", {
    name: "Add playthrough",
    exact: true,
  });
  // Establish a visible trigger, then exclude Playwright's pre-mousedown scrolling.
  await add.scrollIntoViewIfNeeded();
  await expect(add).toBeInViewport();
  const before = await cover.boundingBox();
  const scrollBefore = await page.evaluate(() => scrollY);
  await add.click({ scroll: "none" });
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toBeVisible();
  await expect(page.getByLabel("Started", { exact: true })).toBeVisible();
  expect((await cover.boundingBox())?.y).toBe(before?.y);
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  await page.getByRole("combobox", { name: "Platform", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCSS("translate", "none");
  await expect(
    page.getByRole("combobox", { name: "Platform", exact: true }),
  ).toBeVisible();
});

test("Command results appear immediately without stagger or pointer motion", async ({
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
  await (await openCatalog(page)).fill("games");
  const entries = page
    .getByRole("listbox", { name: "Search results" })
    .getByRole("option");
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toHaveCSS("animation-name", "none");
  await expect(entries.nth(1)).toHaveCSS("animation-delay", "0s");
  await expect(entries.first()).toHaveCSS("opacity", "1");
});

test("View game navigates from Command actions with the existing route transition", async ({
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
  await selectCatalogGame(page, "Celeste");
  const link = page.getByRole("link", {
    name: "View game: Celeste",
    exact: true,
  });
  await expect(link).toBeVisible();
  await link.click();
  await expect(
    page.getByRole("heading", { name: "Celeste", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.motionAnimations.join("\n")))
    .toContain("route-in");
  await expect(
    page.getByRole("button", { name: "Back to results" }),
  ).toHaveCount(0);
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
  test(`Home ${source} navigation uses its own game occurrence after Command selection`, async ({
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
    await selectCatalogGame(page, "Celeste");
    const search = page.getByRole("link", {
      name: "View game: Celeste",
      exact: true,
    });
    await expect(search).toBeVisible();
    const shelf = page
      .getByRole("region", { name: "Recently added" })
      .getByRole("link", { name: "Celeste", exact: true });
    if (source === "shelf") await closeCatalog(page);
    else {
      await expect(search).toHaveAttribute("href", "/games/celeste");
      await search.click();
      await expect(
        page.getByRole("heading", { name: "Celeste", exact: true }),
      ).toBeVisible();
      return;
    }
    await expect(shelf).toBeVisible();
    const link = shelf;
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

test("touch selects Command results without cover movement", async ({
  browser,
}) => {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await (await openCatalog(page)).fill("Celeste");
  const option = page.getByRole("option", { name: /^Celeste/ });
  await expect(option).toHaveCSS("transform", "none");
  await option.tap();
  await expect(
    page.getByRole("button", { name: "Back to results" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/q=Celeste/);
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
    await (await openCatalog(page)).fill("Celeste");
    const cover = page.getByRole("option", { name: /^Celeste/ });
    await expect(cover).toBeVisible();
    if (reduced) {
      await cover.hover();
      await expect(cover).toHaveCSS("transform", "none");
      await expect(cover).toHaveCSS("animation-name", "none");
      await expect(page.locator("[data-cover-glare]")).toBeHidden();
    }
    await cover.click();
    await page
      .getByRole("link", { name: "View game: Celeste", exact: true })
      .click();
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
    await expect(
      page.getByRole("combobox", { name: "Search games", exact: true }),
    ).toBeVisible();
  });
}

test("Command selection works when touch follows a fine pointer", async ({
  page,
}) => {
  await page.goto("/");
  await (await openCatalog(page)).fill("Celeste");
  const option = page.getByRole("option", { name: /^Celeste/ });
  await option.hover();
  await expect(option).toHaveCSS("transform", "none");
  const box = await option.boundingBox();
  if (!box) throw new Error("Result has no bounds");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(option).toHaveCSS("transform", "none");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("button", { name: "Back to results" }),
  ).toBeVisible();
});
