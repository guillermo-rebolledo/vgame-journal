import { expect, test } from "@playwright/test";
import { openCatalog } from "./support/catalog";
import { chooseTheme } from "./support/header";
import { signUp } from "./support/sign-up";
import { supportUrl } from "./support/url";

for (const theme of ["dark", "light"] as const) {
  test(`Catalog progress has a visible shimmer and respects reduced motion (${theme})`, async ({
    page,
  }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/games/search?**", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/");
    await chooseTheme(page, theme);
    await (await openCatalog(page)).fill("Celeste");
    const progress = page.getByRole("status", { name: "Search updates" });
    const compass = progress.locator('[data-slot="spinner"]');
    const label = progress.locator(".shimmer");
    try {
      await expect(progress).toHaveText("Searching…");
      await expect(compass).toBeVisible();
      await expect(compass).toHaveAttribute("aria-hidden", "true");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect(compass.locator("g")).toHaveCSS(
        "animation-name",
        "compass-turn",
      );
      await expect(compass.locator("g")).toHaveCSS(
        "animation-duration",
        "0.5s",
      );
      await expect(label).toHaveCSS("animation-name", "tw-shimmer");
      await expect(label).toHaveCSS("animation-duration", "2s");
      // A running keyframe can still be imperceptible; compare the rendered text.
      await page.evaluate(() => document.fonts.ready);
      const frames: string[] = [];
      for (const time of [0, 1000]) {
        await label.evaluate((el, time) => {
          for (const animation of el.getAnimations()) {
            animation.pause();
            animation.currentTime = time;
          }
        }, time);
        frames.push((await label.screenshot()).toString("base64"));
      }
      const visibleChange = await label.evaluate(async (_, frames) => {
        const pixels: Uint8ClampedArray[] = [];
        for (const png of frames) {
          const bitmap = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${png}`)).blob(),
          );
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          context.drawImage(bitmap, 0, 0);
          pixels.push(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
          );
          bitmap.close();
        }
        let largestChange = 0;
        for (let i = 0; i < pixels[0].length; i += 4) {
          for (let channel = 0; channel < 3; channel++) {
            largestChange = Math.max(
              largestChange,
              Math.abs(pixels[0][i + channel] - pixels[1][i + channel]),
            );
          }
        }
        return largestChange;
      }, frames);
      expect(
        visibleChange,
        "the shimmer must produce a visible sweep, not just a running animation",
      ).toBeGreaterThanOrEqual(60);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(compass.locator("g")).toHaveCSS("animation-name", "none");
      await expect(label).toHaveCSS("animation-name", "none");
      await expect(label).toHaveCSS("background-image", "none");
      const textColor = await label.evaluate(
        (el) => getComputedStyle(el).color,
      );
      await expect(label).toHaveCSS("-webkit-text-fill-color", textColor);
      await page.emulateMedia({
        reducedMotion: "no-preference",
        forcedColors: "active",
      });
      await expect(label).toHaveCSS("animation-name", "none");
      await expect(label).toHaveCSS("background-image", "none");
      await page.emulateMedia({ forcedColors: "none" });
    } finally {
      release();
    }
    await expect(page.getByRole("option", { name: /^Celeste / })).toBeVisible();
    await expect(compass).toHaveCount(0);
    await expect(progress.locator(".shimmer")).toHaveCount(0);
  });
}

test("first reads show static skeletons and resolve to Home, lists and Stats content", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, `loading_${Date.now()}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await request.post(supportUrl("/collection-delay"), {
    data: { email, milliseconds: 2000 },
  });
  try {
    for (const [path, label] of [
      ["/", "Checking Journal status…"],
      ["/lists", "Loading your lists…"],
      ["/stats", "Loading stats…"],
    ]) {
      await page.goto(path, { waitUntil: "commit" });
      const status = page
        .getByRole("main")
        .getByRole("status")
        .filter({ hasText: label });
      await expect(status).toHaveCount(1);
      const placeholder = status.locator("..");
      await expect(
        placeholder.locator('[data-slot="skeleton"]').first(),
      ).toBeVisible();
      await expect(
        placeholder.locator('[data-slot="skeleton"]').first(),
      ).toHaveCSS("animation-name", "none");
      await expect(placeholder.locator("button, a, input")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(status).toHaveCount(0);
      await expect(
        page.getByRole("main").locator('[data-slot="skeleton"]'),
      ).toHaveCount(0);
    }
  } finally {
    await request.post(supportUrl("/collection-delay"), {
      data: { email, milliseconds: 0 },
    });
  }
});
