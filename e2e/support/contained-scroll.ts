import { expect, type Locator, type Page } from "@playwright/test";

export async function expectContainedScroll(page: Page, scroller: Locator) {
  await expect(scroller).toHaveCSS("overscroll-behavior-y", "contain");
  expect(
    await scroller.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  for (const delta of [10000, -10000]) {
    await scroller.evaluate((el, delta) => {
      el.scrollTop = delta > 0 ? el.scrollHeight : 0;
    }, delta);
    await scroller.hover();
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => scrollY)).toBe(before);
  }
}
