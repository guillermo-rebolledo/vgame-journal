import { expect, type Page, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp, uniqueUsername } from "./support/sign-up";

const editor = (page: Page) =>
  page.getByRole("dialog", { name: "Add playthrough", exact: true });
const exported = async (page: Page) =>
  (await page.request.get("/api/account/export")).json();
async function openRemoval(page: Page) {
  await page
    .getByRole("button", { name: /Change Journal status for / })
    .click();
  await page.getByRole("menuitem", { name: "Remove from journal" }).click();
  return page.getByRole("dialog", { name: "Remove Celeste from journal?" });
}

test("lost first-save response retains the recording draft and retry changes the same Playthrough once", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("atomic_lost"));
  await page.goto("/games/celeste");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page
    .getByLabel("Notes (private, optional)")
    .fill("Retained after a lost response");
  await page.route("**/games/celeste", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort();
  });
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page).getByRole("alert")).toContainText("Couldn’t save");
  await expect(page.getByLabel("Notes (private, optional)")).toHaveValue(
    "Retained after a lost response",
  );
  // Reconcile through the account's existing read path before retrying an uncertain response.
  const committed = await exported(page);
  expect(committed.entries).toHaveLength(1);
  expect(committed.statusHistory).toHaveLength(1);
  expect(committed.playthroughs).toHaveLength(1);
  await page.unroute("**/games/celeste");
  await page.getByLabel("Notes (private, optional)").fill("Retried details");
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Playthroughs", exact: true }),
  ).toContainText("Retried details");
  const retried = await exported(page);
  expect(retried.statusHistory).toEqual(committed.statusHistory);
  expect(retried.playthroughs).toHaveLength(1);
  expect(retried.playthroughs[0].id).toBe(committed.playthroughs[0].id);
  expect(retried.playthroughs[0].submissionId).toBe(
    committed.playthroughs[0].submissionId,
  );
});

test("removal rechecks a private-note edit in an independent browser context before confirmation", async ({
  page,
  request,
  browser,
}) => {
  await signUp(page, request, uniqueUsername("atomic_remove"));
  await page.goto("/games/celeste");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Notes (private, optional)").fill("Original note");
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  const otherContext = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const other = await otherContext.newPage();
    await other.goto("/games/celeste");
    const confirmation = await openRemoval(page);
    await expect(confirmation).toBeVisible();
    await other.getByRole("button", { name: "Edit", exact: true }).click();
    await other
      .getByLabel("Notes (private, optional)")
      .fill("New private note from another context");
    await other.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      other.getByRole("dialog", { name: "Edit playthrough", exact: true }),
    ).toHaveCount(0);
    const before = await exported(other);
    await confirmation
      .getByRole("button", { name: "Remove permanently", exact: true })
      .click();
    await expect(
      confirmation.getByRole("button", {
        name: "Remove permanently",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(confirmation).toBeVisible();
    expect(await exported(page)).toEqual(before);
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Playthroughs", exact: true }),
    ).toContainText("New private note from another context");
    const renewed = await openRemoval(page);
    await renewed
      .getByRole("button", { name: "Remove permanently", exact: true })
      .click();
    await expect(renewed).toHaveCount(0);
    await page.reload();
    const after = await exported(page);
    expect(after.entries).toEqual([]);
    expect(after.playthroughs).toEqual([]);
    expect(
      after.statusHistory.map(
        (event: { status: string | null }) => event.status,
      ),
    ).toEqual(["playing", null]);
  } finally {
    await otherContext.close();
  }
});

test("a stale existing-game recording editor reconciles removal and retains the draft", async ({
  page,
  request,
  browser,
}) => {
  await signUp(page, request, uniqueUsername("atomic_editor"));
  await page.goto("/games/celeste");
  await chooseStatus(page, "playing");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page
    .getByLabel("Notes (private, optional)")
    .fill("Unsaved private draft");
  const otherContext = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const other = await otherContext.newPage();
    await other.goto("/games/celeste");
    await openRemoval(other);
    await expect(
      other.getByRole("button", { name: /Add to Journal for / }),
    ).toBeVisible();
    const before = await exported(other);
    await editor(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(editor(page).getByRole("alert")).toContainText(
      "no longer in your Journal",
    );
    await expect(page.getByLabel("Notes (private, optional)")).toHaveValue(
      "Unsaved private draft",
    );
    expect(await exported(page)).toEqual(before);
    // Refresh must not turn this retained existing-game draft into a new membership save.
    await editor(page)
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(editor(page).getByRole("alert")).toContainText(
      "no longer in your Journal",
    );
    expect(await exported(page)).toEqual(before);
  } finally {
    await otherContext.close();
  }
});
