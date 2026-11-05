import { expect, test } from "@playwright/test";
import { signUp } from "./support/sign-up";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Playthrough completion confirms once without taking focus (${reducedMotion})`, async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await signUp(
      page,
      request,
      `action_${reducedMotion === "reduce" ? "reduced" : "full"}_${Date.now()}`,
    );
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto("/games/celeste");
    const add = page.getByRole("button", {
      name: "Add playthrough",
      exact: true,
    });
    await add.click();
    const editor = page.getByRole("dialog", {
      name: "Add playthrough",
      exact: true,
    });
    await editor.getByLabel("Started", { exact: true }).fill("2026-11-01");
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submissions = 0;
    await page.route("**/games/celeste", async (route) => {
      if (route.request().method() === "POST") {
        submissions++;
        await held;
      }
      await route.continue();
    });
    const save = editor.getByRole("button", { name: "Save", exact: true });
    try {
      await save.click();
      await expect(save).toBeDisabled();
      await expect(save).toHaveAttribute("aria-busy", "true");
      await page.keyboard.press("Enter");
      expect(submissions).toBe(1);
      await expect(
        page.getByRole("dialog", { name: "Playthrough saved" }),
      ).toHaveCount(0);
    } finally {
      release();
    }
    const notifications = page.getByRole("region", {
      name: "Notifications",
      exact: true,
    });
    const notification = notifications.getByRole("dialog", {
      name: "Playthrough saved",
      exact: true,
    });
    await expect(notification).toHaveCount(1);
    await expect(notification).toHaveCSS("opacity", "1");
    await expect(editor).toHaveCount(0);
    await expect(add).toBeFocused();
    await expect(notifications).toHaveAttribute("aria-live", "polite");
    await expect(notification).toHaveCSS(
      "transition-property",
      reducedMotion === "reduce" ? "opacity" : "opacity, transform",
    );
    if (reducedMotion === "reduce")
      await expect(notification).toHaveCSS("transform", "none");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = await notification.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
    // A previous completion must not cover a newly opened editor's Save action.
    await add.click();
    await expect(editor).toBeVisible();
    const saveAgain = editor.getByRole("button", { name: "Save", exact: true });
    await saveAgain.click({ trial: true, timeout: 1500 });
    await expect(page.locator('[data-slot="toast"]')).toHaveCount(1);
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(add).toBeFocused();
    await page.keyboard.press("F6");
    await expect(notifications).toBeFocused();
    const dismiss = notification.getByRole("button", {
      name: "Dismiss notification",
    });
    for (
      let step = 0;
      step < 4 &&
      !(await dismiss.evaluate(
        (element) => document.activeElement === element,
      ));
      step++
    )
      await page.keyboard.press("Tab");
    await expect(dismiss).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(notification).toHaveCount(0);
    await expect(add).toBeFocused();
    await page.unrouteAll({ behavior: "wait" });
  });
}

test("Calendar regeneration prevents duplicate requests and keeps failure recovery local", async ({
  page,
  request,
}) => {
  await signUp(page, request, `calendar_action_${Date.now()}`);
  await page.goto("/settings");
  const form = page.getByRole("form", { name: "Calendar feed", exact: true });
  const regenerate = form.getByRole("button", {
    name: "Regenerate URL",
    exact: true,
  });
  const url = form.getByRole("textbox", {
    name: "Calendar feed URL",
    exact: true,
  });
  const original = await url.inputValue();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  await page.route("**/settings", async (route) => {
    if (route.request().method() === "POST") {
      submissions++;
      await held;
    }
    await route.continue();
  });
  try {
    await regenerate.click();
    await expect(regenerate).toBeDisabled();
    await expect(regenerate).toHaveAttribute("aria-busy", "true");
    await expect(form.getByRole("status")).toHaveText("Regenerating…");
    await page.keyboard.press("Enter");
    expect(submissions).toBe(1);
  } finally {
    release();
  }
  await expect(form.getByRole("status")).toHaveText("Regenerated");
  await expect(url).not.toHaveValue(original);
  await expect(regenerate).toBeEnabled();
  await page.unrouteAll({ behavior: "wait" });
  const confirmed = await url.inputValue();
  await page.route("**/settings", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await regenerate.click();
  await expect(form.getByRole("alert")).toContainText(
    "Refresh Settings and try again.",
  );
  await expect(form.getByRole("status")).toBeEmpty();
  await expect(url).toHaveValue(confirmed);
  await expect(regenerate).toBeEnabled();
  await page.unrouteAll({ behavior: "wait" });
  await regenerate.click();
  await expect(form.getByRole("status")).toHaveText("Regenerated");
});
