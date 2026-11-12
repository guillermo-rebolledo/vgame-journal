import { expect, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Journal confirmation preserves focus and keyboard immediacy with ${reducedMotion}`, async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ reducedMotion });
    const email = await signUp(
      page,
      request,
      uniqueUsername("confirmation_motion"),
    );
    await page.goto("/games/celeste");
    await chooseStatus(page, "playing");
    await seedSql(
      request,
      [
        'update journal_entry set rating=8, rated_at=now() where user_id=(select id from "user" where email=$1)',
      ],
      [email],
    );
    await page.reload();
    const trigger = page.getByRole("button", {
      name: /Change Journal status for Celeste/,
    });
    const remove = page.getByRole("menuitem", {
      name: "Remove from journal",
      exact: true,
    });
    const dialog = page.getByRole("dialog", {
      name: "Remove Celeste from journal?",
    });
    await trigger.click();
    await remove.click();
    await expect(dialog).toHaveAttribute("data-pointer-motion", "true");
    await expect(dialog).toHaveCSS(
      "transition-duration",
      reducedMotion === "reduce" ? "0.15s" : "0.2s",
    );
    await expect(dialog).toHaveCSS(
      "transition-property",
      reducedMotion === "reduce" ? "opacity" : "opacity, transform",
    );
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await remove.focus();
    await remove.press("Enter");
    await expect(dialog).toHaveAttribute("data-pointer-motion", "false");
    await expect(dialog).toHaveCSS("transition-duration", "0s");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}
