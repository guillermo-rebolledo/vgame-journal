import type { Page, TestInfo } from "@playwright/test";

/** A viewport screenshot once animations settle, attached to the report. */
export async function snap(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = false,
) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)),
  );
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage });
  await testInfo.attach(name, { path, contentType: "image/png" });
}
