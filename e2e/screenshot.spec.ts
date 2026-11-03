import { test } from "@playwright/test";
import { snap } from "./support/snap";

test("report screenshots settle when an in-flight animation is canceled", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => {
    document.body.animate([{ opacity: 0.9 }, { opacity: 1 }], {
      duration: 60_000,
    });
  });
  await Promise.all([
    snap(page, testInfo, "canceled-animation"),
    page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.cancel();
    }),
  ]);
});
