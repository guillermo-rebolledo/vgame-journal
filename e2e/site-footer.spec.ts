import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";

test("footer links stay spaced, visible and keyboard accessible at narrow widths", async ({
  page,
}) => {
  await page.goto("/privacy");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const footer = page.getByRole("contentinfo");
  for (const theme of ["light", "dark"] as const) {
    await chooseTheme(page, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const fontSize of ["100%", "200%"]) {
        await page.locator("html").evaluate((html, size) => {
          html.style.fontSize = size;
        }, fontSize);
        await expect(footer.getByRole("navigation")).toHaveAccessibleName(
          "Footer",
        );
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          )
          .toBe(true);
        const links = footer.getByRole("link");
        await links.first().focus();
        for (const [index, link] of (await links.all()).entries()) {
          if (index > 0) await page.keyboard.press("Tab");
          await expect(link).toBeFocused();
          await expect(link).toBeInViewport();
          const bounds = await link.boundingBox();
          expect(bounds?.height).toBeGreaterThanOrEqual(44);
        }
        await expect(footer.locator("ul")).toHaveCSS("column-gap", /24px|48px/);
        if (fontSize === "100%" && (width === 390 || width === 1440))
          await footer.screenshot({
            path: `/tmp/site-footer-${theme}-${width}.png`,
          });
      }
      await page.locator("html").evaluate((html) => {
        html.style.fontSize = "100%";
      });
    }
  }
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/guillermo-rebolledo",
  );
});
