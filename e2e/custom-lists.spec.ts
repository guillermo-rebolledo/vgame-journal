import { randomUUID } from "node:crypto";
import {
  type APIRequestContext,
  expect,
  type Page,
  type Request,
  test,
} from "@playwright/test";
import { selectCatalogGame } from "./support/catalog";
import { chooseStatus } from "./support/journal";
import {
  closeListPanel,
  openListOptions,
  openListPanel,
} from "./support/list-editor";
import { signUp, uniqueUsername } from "./support/sign-up";
import { snap } from "./support/snap";

async function createList(page: Page, title: string) {
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill(title);
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("button", { name: "Save details", exact: true }),
  ).toBeEnabled();
  return new URL(page.url()).pathname;
}

async function addGame(page: Page, title: string) {
  await openListPanel(page, "Add games");
  await selectCatalogGame(page, title);
  await page
    .getByRole("button", { name: `Add to list: ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Already in list: ${title}`,
      exact: true,
    }),
  ).toBeDisabled();
}

async function postAction(
  request: APIRequestContext,
  action: Request,
  args: unknown[],
) {
  const response = await request.post(action.url(), {
    headers: {
      "next-action": action.headers()["next-action"],
      "content-type": action.headers()["content-type"],
      origin: new URL(action.url()).origin,
    },
    data: JSON.stringify(args),
  });
  expect(response.status()).toBe(200);
  return response.text();
}

async function exported(request: APIRequestContext) {
  const response = await request.get("/api/account/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return response.json();
}

test("real Next actions recheck sessions and ownership for every list mutation family", async ({
  page,
  request,
  browser,
}) => {
  await signUp(page, request, uniqueUsername("lists_accept_actions"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("ACTION_PRIVATE_TITLE_88");
  const creating = page.waitForRequest((r) => !!r.headers()["next-action"]);
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  const create = await creating;
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("button", { name: "Save details", exact: true }),
  ).toBeEnabled();
  const editing = page.waitForRequest((r) => !!r.headers()["next-action"]);
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  const edit = await editing;
  await expect(
    page.getByRole("dialog", { name: "Details saved." }),
  ).toBeVisible();
  const changing = page.waitForRequest((r) => !!r.headers()["next-action"]);
  await addGame(page, "Celeste");
  const change = await changing;
  const before = await exported(page.request);
  const list = before.lists[0];
  const [owner] = JSON.parse(edit.postData() as string);
  const stranger = await browser.newContext();
  const anonymous = await browser.newContext();
  try {
    await signUp(
      await stranger.newPage(),
      request,
      uniqueUsername("lists_accept_attacker"),
    );
    const session = await (
      await stranger.request.get("/api/auth/get-session")
    ).json();
    const operations = [
      { kind: "visibility", visibility: "public" },
      { kind: "add", gameId: list.games[0].gameId },
      { kind: "remove", gameId: list.games[0].gameId },
      { kind: "reorder", gameIds: [list.games[0].gameId] },
      { kind: "delete" },
    ];
    const calls = [
      {
        action: edit,
        args: [
          owner,
          list.id,
          list.revision,
          { title: "FORGED_88", description: "forged" },
        ],
      },
      ...operations.map((operation) => ({
        action: change,
        args: [owner, list.id, list.revision, operation],
      })),
      {
        action: create,
        args: [
          owner,
          { title: "FORGED_88", submissionId: randomUUID(), ownerId: owner },
        ],
      },
    ];
    for (const { action, args } of calls) {
      // Correct origin and a live action ID ensure the application boundary rejects the request.
      for (const client of [anonymous.request, stranger.request]) {
        const body = await postAction(client, action, args);
        expect(body).toContain('"code":"authentication"');
        expect(body).not.toContain("ACTION_PRIVATE_TITLE_88");
      }
      if (action !== create) {
        const body = await postAction(stranger.request, action, [
          session.user.id,
          ...args.slice(1),
        ]);
        expect(body).toContain('"code":"not_found"');
        expect(body).not.toContain("ACTION_PRIVATE_TITLE_88");
      }
    }
    for (const invalid of [
      null,
      { kind: "unknown" },
      { kind: "reorder", gameIds: [1, 1] },
      { kind: "visibility", visibility: "friends" },
    ]) {
      expect(
        await postAction(page.request, change, [
          owner,
          list.id,
          list.revision,
          invalid,
        ]),
      ).toContain('"code":"validation"');
    }
    expect((await exported(page.request)).lists).toEqual(before.lists);
    expect((await exported(stranger.request)).lists).toEqual([]);
  } finally {
    await stranger.close();
    await anonymous.close();
  }
});

async function deniedList(
  request: APIRequestContext,
  path: string,
  secrets: string[],
) {
  for (const headers of [
    {},
    { RSC: "1" },
    { "user-agent": "Twitterbot" },
  ] as Record<string, string>[]) {
    const response = await request.get(path, { headers });
    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const body = await response.text();
    for (const secret of secrets) expect(body).not.toContain(secret);
    expect(body).toContain("noindex");
  }
}

test("creator publication lifecycle refreshes discovery and revokes new HTML, Flight and metadata reads", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const username = uniqueUsername("lists_accept_lifecycle");
  await signUp(page, request, username);
  await page.goto("/settings");
  const visibility = page.getByRole("form", { name: "Profile visibility" });
  await visibility.getByRole("radio", { name: /^Public/ }).check();
  await visibility.getByRole("button", { name: "Save", exact: true }).click();
  await expect(visibility.getByRole("status")).toHaveText("Saved");
  await page.goto("/lists");
  const ownerPath = await createList(page, "LIFECYCLE_PRIVATE_88");
  await openListPanel(page, "Edit list");
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("LIFECYCLE_DESCRIPTION_88\n<em>Plain text</em>");
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Details saved." }),
  ).toBeVisible();
  await addGame(page, "Celeste");
  await page.goto("/games/hades--1?addToList=1");
  await page
    .getByRole("button", {
      name: "Add here: Hades to LIFECYCLE_PRIVATE_88",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Already in list: Hades in LIFECYCLE_PRIVATE_88",
      exact: true,
    }),
  ).toBeDisabled();
  await page.goto(ownerPath);
  await page
    .getByRole("button", { name: "Refresh saved list", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit details", exact: true }),
  ).toBeEnabled();
  await closeListPanel(page);
  await page
    .getByRole("button", { name: "Move Hades up", exact: true })
    .click();
  const games = page.getByRole("list", { name: "List games", exact: true });
  await closeListPanel(page);
  await expect(games.getByRole("link")).toHaveText(["Hades", "Celeste"]);
  await snap(page, testInfo, "owner-desktop", true);
  const path = `/u/${username}${ownerPath}`;
  const profile = `/u/${username}?view=lists`;
  const visitor = await browser.newContext();
  const stranger = await browser.newContext();
  try {
    const guest = await visitor.newPage();
    await signUp(
      await stranger.newPage(),
      request,
      uniqueUsername("lists_accept_reader"),
    );
    for (const client of [visitor.request, stranger.request, page.request]) {
      await deniedList(client, path, [
        "LIFECYCLE_PRIVATE_88",
        "LIFECYCLE_DESCRIPTION_88",
        "Celeste",
        "Hades",
      ]);
    }
    await guest.goto(profile);
    await expect(
      guest.getByRole("main").getByText("0 public lists", { exact: true }),
    ).toBeVisible();
    await openListPanel(page, "Visibility and sharing");
    await page
      .getByRole("button", { name: "Publish list", exact: true })
      .click();
    await openListPanel(page, "Visibility and sharing");
    const sharing = page.getByRole("textbox", {
      name: "Public list URL",
      exact: true,
    });
    await openListPanel(page, "Visibility and sharing");
    await expect(sharing).toHaveValue(`https://www.shelve.games${path}`);
    await guest.reload();
    await expect(
      guest.getByRole("main").getByText("1 public list", { exact: true }),
    ).toBeVisible();
    await guest.getByRole("link", { name: /LIFECYCLE_PRIVATE_88/ }).click();
    await expect(
      guest.getByRole("list", { name: "List games" }).getByRole("link"),
    ).toHaveText(["Hades", "Celeste"]);
    await expect(guest).toHaveTitle(
      `LIFECYCLE_PRIVATE_88 by ${username} · shelve.games`,
    );
    await openListPanel(page, "Edit list");
    await page
      .getByRole("textbox", { name: "List title", exact: true })
      .fill("LIFECYCLE_RENAMED_88");
    await openListPanel(page, "Edit list");
    await page
      .getByRole("button", { name: "Save details", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "LIFECYCLE_RENAMED_88", exact: true }),
    ).toBeVisible();
    await openListPanel(page, "Visibility and sharing");
    await expect(sharing).toHaveValue(`https://www.shelve.games${path}`);
    await guest.reload();
    await expect(
      guest.getByRole("heading", { name: "LIFECYCLE_RENAMED_88", exact: true }),
    ).toBeVisible();
    await expect(guest.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://www.shelve.games${path}`,
    );
    await guest.setViewportSize({ width: 320, height: 760 });
    await snap(guest, testInfo, "public-mobile", true);
    expect((await stranger.request.get(path)).status()).toBe(200);
    await openListPanel(page, "Visibility and sharing");
    await page
      .getByRole("button", { name: "Make private", exact: true })
      .click();
    await expect(sharing).toHaveCount(0);
    for (const client of [visitor.request, stranger.request]) {
      await deniedList(client, path, [
        "LIFECYCLE_RENAMED_88",
        "LIFECYCLE_DESCRIPTION_88",
        "Celeste",
        "Hades",
      ]);
      const response = await client.get(profile, { headers: { RSC: "1" } });
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(await response.text()).not.toContain("LIFECYCLE_RENAMED_88");
    }
    await guest.goto(profile);
    await expect(
      guest.getByRole("main").getByText("0 public lists", { exact: true }),
    ).toBeVisible();
    await expect(
      guest
        .getByRole("main")
        .getByText("No public lists yet.", { exact: true }),
    ).toBeVisible();
    await snap(guest, testInfo, "unpublished-profile-mobile", true);
    await openListPanel(page, "Visibility and sharing");
    await page
      .getByRole("button", { name: "Publish list", exact: true })
      .click();
    await openListPanel(page, "Visibility and sharing");
    await expect(sharing).toHaveValue(`https://www.shelve.games${path}`);
    await guest.reload();
    await expect(
      guest.getByRole("main").getByText("1 public list", { exact: true }),
    ).toBeVisible();
    await guest.goto(path);
    await expect(
      guest.getByRole("list", { name: "List games" }).getByRole("link"),
    ).toHaveText(["Hades", "Celeste"]);
    page.once("dialog", (dialog) => dialog.accept());
    await openListOptions(page);
    await page
      .getByRole("menuitem", { name: "Delete list", exact: true })
      .click();
    await expect(page).toHaveURL(/\/lists$/);
    await deniedList(visitor.request, path, [
      "LIFECYCLE_RENAMED_88",
      "LIFECYCLE_DESCRIPTION_88",
      "Celeste",
      "Hades",
    ]);
    await guest.goto(profile);
    await expect(
      guest.getByRole("main").getByText("0 public lists", { exact: true }),
    ).toBeVisible();
  } finally {
    await visitor.close();
    await stranger.close();
  }
});

test("lists preserve Journal history and account export/deletion stays complete and isolated", async ({
  page,
  request,
  browser,
}) => {
  // Two account lifecycles and the full list/deletion flow can exceed 30s on shared CI workers.
  test.setTimeout(90_000);
  const username = uniqueUsername("lists_accept_account");
  await signUp(page, request, username);
  await page.goto("/games/celeste");
  await chooseStatus(page, "played");
  await chooseStatus(page, "completed");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page
    .getByLabel("Finished (optional)", { exact: true })
    .fill("2026-01-02");
  await page.getByLabel("Hours (optional)", { exact: true }).fill("3");
  await page
    .getByLabel("Notes (private, optional)", { exact: true })
    .fill("ACCOUNT_PRIVATE_NOTE_88");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("dialog").and(page.locator(':not([data-slot="toast"])')),
  ).toHaveCount(0);
  await page.goto("/games/silksong");
  await chooseStatus(page, "wishlist");
  await page.goto("/settings");
  const feed = await page
    .getByRole("textbox", { name: "Calendar feed URL" })
    .inputValue();
  const calendar = (await (await page.request.get(feed)).text()).replace(
    /^DTSTAMP:.*$/gm,
    "",
  );
  const before = await exported(page.request);
  const privatePath = await createList(page, "ACCOUNT_PRIVATE_LIST_88");
  await addGame(page, "Celeste");
  await addGame(page, "Hades");
  await closeListPanel(page);
  await page
    .getByRole("button", { name: "Move Hades up", exact: true })
    .click();
  await expect(
    page.getByRole("list", { name: "List games" }).getByRole("link"),
  ).toHaveText(["Hades", "Celeste"]);
  const publicPath = await createList(page, "Account public list");
  await addGame(page, "Celeste");
  await openListPanel(page, "Visibility and sharing");
  await page.getByRole("button", { name: "Publish list", exact: true }).click();
  await openListPanel(page, "Visibility and sharing");
  await expect(
    page.getByRole("textbox", { name: "Public list URL", exact: true }),
  ).toBeVisible();
  const after = await exported(page.request);
  for (const key of ["entries", "statusHistory", "playthroughs"])
    expect(after[key]).toEqual(before[key]);
  expect(after.lists).toHaveLength(2);
  expect(after.lists).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: "ACCOUNT_PRIVATE_LIST_88",
        visibility: "private",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        games: [
          expect.objectContaining({ title: "Hades", slug: "hades--1" }),
          expect.objectContaining({ title: "Celeste", slug: "celeste" }),
        ],
      }),
      expect.objectContaining({
        title: "Account public list",
        visibility: "public",
        games: [expect.objectContaining({ title: "Celeste" })],
      }),
    ]),
  );
  expect(JSON.stringify(after.lists)).not.toContain("submissionId");
  expect(
    (await (await page.request.get(feed)).text()).replace(/^DTSTAMP:.*$/gm, ""),
  ).toBe(calendar);
  await page.goto("/stats");
  await expect(
    page
      .getByRole("list", { name: "hours by category" })
      .getByText("3 hours", { exact: true }),
  ).toBeVisible();
  await page.goto("/wishlist");
  await expect(
    page
      .getByRole("heading", { name: "Silksong", exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  // Removing Journal membership must not remove an overlapping List Entry.
  await page.goto("/games/hades--1");
  await chooseStatus(page, "playing");
  await page
    .getByRole("button", {
      name: /Change Journal status for Hades$/,
      exact: true,
    })
    .click();
  await closeListPanel(page);
  await page
    .getByRole("menuitem", { name: "Remove from journal", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Add to Journal for Hades",
      exact: true,
    }),
  ).toHaveAttribute("aria-description", "Not in your journal");
  expect((await exported(page.request)).lists).toEqual(after.lists);
  const survivor = await browser.newContext();
  const guest = await browser.newContext();
  const stale = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const other = await survivor.newPage();
    await signUp(other, request, uniqueUsername("lists_accept_survivor"));
    const survivingPath = await createList(other, "Surviving collection");
    await addGame(other, "Celeste");
    await other.goto("/games/celeste");
    await chooseStatus(other, "backlog");
    const survivingExport = await exported(other.request);
    expect(
      (await guest.request.get(`/u/${username}${publicPath}`)).status(),
    ).toBe(200);
    await page.goto("/settings");
    await page.getByLabel("Current password").fill("password123");
    await page
      .getByRole("button", { name: "Confirm password", exact: true })
      .click();
    await expect(page.getByLabel("Type DELETE to confirm")).toBeFocused();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page
      .getByRole("button", { name: "Permanently delete account", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    expect((await stale.request.get("/api/account/export")).status()).toBe(401);
    for (const path of [publicPath, privatePath])
      await deniedList(guest.request, `/u/${username}${path}`, [
        "ACCOUNT_PRIVATE_LIST_88",
        "Account public list",
        "ACCOUNT_PRIVATE_NOTE_88",
      ]);
    expect((await guest.request.get(feed)).status()).toBe(404);
    expect(await exported(survivor.request)).toEqual(survivingExport);
    await other.goto(survivingPath);
    await expect(
      other.getByRole("list", { name: "List games" }).getByRole("link"),
    ).toHaveText(["Celeste"]);
    expect((await guest.request.get("/games/celeste")).status()).toBe(200);
    expect((await guest.request.get("/games/hades--1")).status()).toBe(200);
  } finally {
    await survivor.close();
    await guest.close();
    await stale.close();
  }
});
