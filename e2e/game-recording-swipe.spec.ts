import { expect, type Page, test } from "@playwright/test";
import { signUp } from "./support/sign-up";

test.use({ video: "on" });

async function swipeHandle(page: Page, touch: boolean) {
  const handle = page.locator('[data-slot="drawer-swipe-handle"]');
  await expect(handle).toBeVisible();
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Swipe handle has no bounds");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const distance = ((page.viewportSize()?.height ?? 844) - y) * 0.75;
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 12; step++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + (distance * step) / 12 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + distance, { steps: 12 });
    await page.mouse.up();
  }
}

for (const phone of [false, true]) {
  test.describe(phone ? "phone swipe" : "desktop swipe", () => {
    test.use({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      hasTouch: phone,
    });
    test("drawer leaves space below navigation and swipe dismissal retains the draft and focus", async ({
      page,
      request,
    }) => {
      await signUp(page, request, `swipe_${phone}_${Date.now()}`);
      await page.goto("/games/celeste");
      const add = page.getByRole("button", {
        name: "Add playthrough",
        exact: true,
      });
      await add.click();
      const dialog = page.getByRole("dialog");
      await page
        .locator('[data-slot="drawer-swipe-handle"]')
        .scrollIntoViewIfNeeded();
      // Measure the settled drawer, rather than a frame of its entrance transition.
      await expect
        .poll(() =>
          dialog.evaluate((node) =>
            Math.abs(
              new DOMMatrixReadOnly(getComputedStyle(node).transform).m42,
            ),
          ),
        )
        .toBeLessThan(0.01);
      const box = await dialog.boundingBox();
      const navbar = await page
        .getByRole("banner", { includeHidden: true })
        .filter({ visible: true })
        .boundingBox();
      expect(box?.y).toBeGreaterThanOrEqual(
        (navbar?.y ?? 0) + (navbar?.height ?? 0) + 12,
      );
      if (phone) {
        expect(box?.x).toBe(0);
        expect(box?.width).toBe(page.viewportSize()?.width);
      } else {
        expect(box?.width).toBeLessThanOrEqual(768);
        expect(box?.height).toBeLessThanOrEqual(720);
        expect(box?.x).toBeGreaterThan(0);
      }
      const save = page.getByRole("button", { name: "Save", exact: true });
      await page
        .getByLabel("Notes (private, optional)")
        .scrollIntoViewIfNeeded();
      const afterScroll = await dialog.boundingBox();
      expect(afterScroll).toEqual(box);
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport();
      await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
      await page.getByLabel("Notes (private, optional)").fill("My swipe draft");
      await swipeHandle(page, phone);
      await expect(dialog).toHaveCount(0);
      await expect(add).toBeFocused();
      const exported = await (
        await page.request.get("/api/account/export")
      ).json();
      expect(exported.entries).toHaveLength(0);
      expect(exported.playthroughs).toHaveLength(0);
      await add.click();
      await expect(page.getByLabel("Notes (private, optional)")).toHaveValue(
        "My swipe draft",
      );
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await add.click();
      await expect(dialog).toHaveCSS("transform", "none");
      await swipeHandle(page, phone);
      await expect(dialog).toHaveCount(0);
    });
  });
}

test("swiping while a save is pending leaves the editor open until persistence finishes", async ({
  page,
  request,
}) => {
  await signUp(page, request, `pending_swipe_${Date.now()}`);
  await page.goto("/games/celeste");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  let release: () => void = () => {};
  const saving = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/games/celeste", async (route) => {
    if (route.request().method() === "POST") await saving;
    await route.continue();
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  try {
    await swipeHandle(page, false);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.playthroughs).toHaveLength(1);
});
