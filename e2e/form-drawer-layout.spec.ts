import { expect, type Locator, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./support/sign-up";

async function expectFullWidthBottomDrawer(drawer: Locator) {
  await expect
    .poll(() =>
      drawer.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return {
          left: Math.round(bounds.left),
          width: Math.round(bounds.width),
          bottomGap: Math.round(window.innerHeight - bounds.bottom),
          viewportWidth: window.innerWidth,
        };
      }),
    )
    .toEqual({
      left: 0,
      width: await drawer.page().evaluate(() => window.innerWidth),
      bottomGap: 0,
      viewportWidth: await drawer.page().evaluate(() => window.innerWidth),
    });
}

async function scrollableOverflow(drawer: Locator) {
  return drawer.evaluate((node) =>
    [node, ...node.querySelectorAll("*")].some(
      (element) =>
        /auto|scroll/.test(getComputedStyle(element).overflowY) &&
        element.scrollHeight > element.clientHeight + 1,
    ),
  );
}

test("desktop form drawers fit content and only scroll when the viewport is too short", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, request, uniqueUsername("form_drawers"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  const creation = page.getByRole("dialog", {
    name: "Create a list",
    exact: true,
  });
  await expectFullWidthBottomDrawer(creation);
  await expect.poll(() => scrollableOverflow(creation)).toBe(false);
  await expect
    .poll(async () => (await creation.boundingBox())?.height ?? 0)
    .toBeLessThan(720);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1200 });
    await expectFullWidthBottomDrawer(creation);
    await expect.poll(() => scrollableOverflow(creation)).toBe(false);
    await expect
      .poll(async () => (await creation.boundingBox())?.height ?? 0)
      .toBeLessThan(900);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('[data-slot="drawer-overlay"]')).toHaveCSS(
    "background-color",
    "oklab(0 0 0 / 0.6)",
  );
  await creation
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Favorites");
  await creation
    .getByRole("button", { name: "Create list", exact: true })
    .click();
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);

  await page.goto("/games/celeste");
  const trigger = page.getByRole("button", {
    name: "Add to list",
    exact: true,
  });
  await trigger.click();
  const picker = page.getByRole("dialog", { name: "Add to list", exact: true });
  await expect(picker.getByText("Favorites", { exact: true })).toBeVisible();
  await expectFullWidthBottomDrawer(picker);
  const collapsedHeight = (await picker.boundingBox())?.height ?? 0;
  await picker.getByText("Create a new list", { exact: true }).click();
  await expect(
    picker.getByRole("textbox", { name: "List title", exact: true }),
  ).toBeVisible();
  await expect.poll(() => scrollableOverflow(picker)).toBe(false);
  await expect
    .poll(async () => (await picker.boundingBox())?.height ?? 0)
    .toBeGreaterThan(collapsedHeight);
  await expect
    .poll(async () => (await picker.boundingBox())?.height ?? 0)
    .toBeGreaterThan(720);
  await page.setViewportSize({ width: 880, height: 800 });
  await expect.poll(() => scrollableOverflow(picker)).toBe(false);
  await expect(
    picker.getByRole("button", {
      name: "Create list and add Celeste",
      exact: true,
    }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: testInfo.outputPath("expanded-list-desktop.png"),
  });

  await page.setViewportSize({ width: 1440, height: 600 });
  await expect.poll(() => scrollableOverflow(picker)).toBe(true);
  await expect
    .poll(async () => (await picker.boundingBox())?.y ?? -1)
    .toBeGreaterThanOrEqual(16);
  const submit = picker.getByRole("button", {
    name: "Create list and add Celeste",
    exact: true,
  });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: testInfo.outputPath("expanded-list-short-desktop.png"),
  });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 1000 });
  const add = page.getByRole("button", {
    name: "Add playthrough",
    exact: true,
  });
  await add.click();
  const playthrough = page.getByRole("dialog", {
    name: "Add playthrough",
    exact: true,
  });
  await expectFullWidthBottomDrawer(playthrough);
  await expect.poll(() => scrollableOverflow(playthrough)).toBe(false);
  await expect(
    playthrough.getByRole("button", { name: "Save", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: testInfo.outputPath("playthrough-desktop.png"),
  });
  await page.setViewportSize({ width: 1440, height: 500 });
  await expect.poll(() => scrollableOverflow(playthrough)).toBe(true);
  const save = playthrough.getByRole("button", { name: "Save", exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Send feedback", exact: true })
    .click();
  const feedback = page.getByRole("dialog", {
    name: "Send feedback",
    exact: true,
  });
  await expectFullWidthBottomDrawer(feedback);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expectFullWidthBottomDrawer(feedback);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => scrollableOverflow(feedback)).toBe(false);
  // Enlarging a textarea should grow the drawer before introducing a scrollbar.
  await feedback
    .getByRole("textbox", { name: "Message", exact: true })
    .evaluate((node) => {
      node.style.height = "700px";
    });
  await expect
    .poll(async () => (await feedback.boundingBox())?.height ?? 0)
    .toBeGreaterThan(904);
  await page.setViewportSize({ width: 1440, height: 500 });
  await expect.poll(() => scrollableOverflow(feedback)).toBe(true);
  const cancel = feedback.getByRole("button", { name: "Cancel", exact: true });
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toBeInViewport({ ratio: 1 });
});
