import type { Page, TestInfo } from "@playwright/test";

/** Settle finite transitions and freeze loading loops for the captured frame. */
export async function snap(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = false,
) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}
