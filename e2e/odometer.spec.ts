import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";

test("Wishlist countdown digits align with their units in both themes, widths, and motion preferences", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername(`digits`));
  await page.goto("/games/silksong");
  await chooseStatus(page, "wishlist");
  await seedSql(
    request,
    [
      "update release_date set date = '2099-06-01', precision = 'day' where game_id = 2",
    ],
    [],
  );
  await page.goto("/wishlist");
  const countdown = page
    .locator("span.tabular-nums")
    .filter({ has: page.locator(".sr-only") });
  await expect(countdown).toHaveCount(1);
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const reducedMotion of ["no-preference", "reduce"] as const) {
        await page.emulateMedia({ reducedMotion });
        const offsets = await countdown.evaluate(async (element) => {
          await document.fonts.ready;
          await Promise.all(
            element
              .getAnimations({ subtree: true })
              .map((animation) => animation.finished),
          );
          const visual = element.querySelector("[aria-hidden]");
          if (!visual) throw new Error("Missing visual countdown");
          const values =
            element.querySelector(".sr-only")?.textContent?.match(/\d/g) ?? [];
          const clips = [...visual.children].filter((child) =>
            child.querySelector(".flex-col"),
          );
          return clips.map((clip, index) => {
            let label = clip.nextElementSibling;
            while (label?.querySelector(".flex-col"))
              label = label.nextElementSibling;
            const glyph =
              clip.firstElementChild?.children[Number(values[index])];
            if (!label || !glyph)
              throw new Error("Missing countdown digit or unit");
            const range = document.createRange();
            range.selectNodeContents(glyph);
            const digitTop = range.getBoundingClientRect().top;
            range.selectNodeContents(label);
            return Math.abs(digitTop - range.getBoundingClientRect().top);
          });
        });
        expect(offsets.length).toBeGreaterThan(0);
        for (const offset of offsets)
          expect(
            offset,
            `${theme}, ${width}px, ${reducedMotion}`,
          ).toBeLessThanOrEqual(1);
      }
    }
  }
});
