import { expect, test } from "@playwright/test";
import { openListPanel } from "./support/list-editor";
import { signUp, uniqueUsername } from "./support/sign-up";

for (const storageAvailable of [true, false]) {
  test(`list creation retains drafts with ${storageAvailable ? "available" : "blocked"} storage and opens the created list`, async ({
    page,
    request,
  }) => {
    await signUp(page, request, uniqueUsername("lists_drawer"));
    if (!storageAvailable)
      await page.addInitScript(() => {
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === window.sessionStorage)
            throw new Error("Storage unavailable");
          return setItem.call(this, key, value);
        };
      });
    await page.goto("/lists");
    await expect(
      page.getByRole("heading", { name: "Lists", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "List title", exact: true }),
    ).toHaveCount(0);
    const create = page.getByRole("button", {
      name: "Create a list",
      exact: true,
    });
    await create.click();
    const drawer = page.getByRole("dialog", {
      name: "Create a list",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await drawer
      .getByRole("textbox", { name: "List title", exact: true })
      .fill("Weekend games");
    await drawer
      .getByRole("textbox", { name: "Description (optional)", exact: true })
      .fill("A quiet weekend");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(create).toBeFocused();
    await create.click();
    await expect(
      drawer.getByRole("textbox", { name: "List title", exact: true }),
    ).toHaveValue("Weekend games");
    await expect(
      drawer.getByRole("textbox", {
        name: "Description (optional)",
        exact: true,
      }),
    ).toHaveValue("A quiet weekend");
    await drawer
      .getByRole("button", { name: "Create list", exact: true })
      .click();
    await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
    await expect(
      page.getByRole("heading", { name: "Weekend games", exact: true }),
    ).toBeVisible();
  });
}

test("invalid list titles identify and focus the field during creation and editing", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("lists_validation"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  const title = page.getByRole("textbox", { name: "List title", exact: true });
  await title.fill("   ");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAccessibleDescription("Enter a list title.");
  await expect(title).toBeFocused();
  await title.fill("Valid title");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
  await openListPanel(page, "Edit list");
  await title.fill("   ");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAccessibleDescription("Enter a list title.");
  await expect(title).toBeFocused();
});
