import { expect, test } from "@playwright/test";
import { closeCatalog, selectCatalogGame } from "./support/catalog";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";
import { supportUrl } from "./support/url";

const updates = (page: import("@playwright/test").Page) =>
  page.getByRole("status", { name: "Journal updates", exact: true });
const count = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("link", { name, exact: true, includeHidden: true });
const current = (page: import("@playwright/test").Page, status: string) =>
  page
    .getByRole("dialog")
    .getByText(`Current status: ${status}`, { exact: true });

test("switching games during a pending save keeps feedback scoped and persists both statuses", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername(`save_scope`));
  await page.goto("/?q=ce");
  await page.getByRole("option", { name: /^Celeste/ }).click();
  const actions = page.getByRole("dialog");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"] && !held) {
      held = true;
      await gate;
    }
    await route.continue();
  });
  try {
    await actions
      .getByRole("button", { name: "Save to Backlog", exact: true })
      .click();
    await expect(
      actions
        .getByRole("button", { name: "Save to Backlog", exact: true })
        .locator("[data-action-state=pending]"),
    ).toBeVisible();
    await actions.getByRole("button", { name: "Back to results" }).click();
    await page.getByRole("option", { name: /^Dead Cells/ }).click();
    await actions
      .getByRole("button", { name: "Save to Wishlist", exact: true })
      .click();
    await expect(updates(page)).toHaveText("Saving Dead Cells to Wishlist…");
    release();
    await expect(current(page, "Wishlist")).toBeVisible();
    await expect(
      actions
        .getByRole("button", { name: "Save to Wishlist", exact: true })
        .locator("[data-action-state=success]"),
    ).toBeVisible();
    await expect(updates(page)).toHaveText("Dead Cells saved to Wishlist.");
    await expect(updates(page)).toHaveCount(1);
    await expect(count(page, "Backlog (1)")).toBeVisible();
    await expect(count(page, "Wishlist (1)")).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
  await actions.getByRole("button", { name: "Back to results" }).click();
  await expect(updates(page)).toBeEmpty();
  await page.reload();
  await selectCatalogGame(page, "Celeste");
  await expect(current(page, "Backlog")).toBeVisible();
  await expect(updates(page)).toBeEmpty();
  await selectCatalogGame(page, "Dead Cells");
  await expect(current(page, "Wishlist")).toBeVisible();
  await expect(updates(page)).toBeEmpty();
});

test("an unconfirmed status change cannot make the retained status a false local no-op", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername(`uncertain`));
  await page.goto("/games/celeste");
  await chooseStatus(page, "played");
  await page.goto("/?q=Celeste");
  const actions = await selectCatalogGame(page, "Celeste");
  await expect(current(page, "Played")).toBeVisible();
  let failed = 0;
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"]) {
      if (failed++ === 0) await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await actions
    .getByRole("button", { name: "Save to Backlog", exact: true })
    .click();
  await expect(
    actions.getByRole("button", {
      name: "Retry Celeste to Backlog",
      exact: true,
    }),
  ).toBeVisible();
  await expect(updates(page)).toContainText("Celeste: save not confirmed");
  await expect(current(page, "Played")).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await actions
    .getByRole("button", { name: "Save to Played", exact: true })
    .click();
  await expect(updates(page)).toContainText("Celeste saved to Played");
  await page.reload();
  await selectCatalogGame(page, "Celeste");
  await expect(current(page, "Played")).toBeVisible();
  await expect(count(page, "Backlog (0)")).toBeVisible();
});

test("Home saves a selected game without losing browsing context and opens filtered Backlog", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername(`quick`));
  await expect(count(page, "Backlog (0)")).toBeVisible();
  await page.goto("/?q=Celeste&year=2018&all=1");
  await page.getByRole("option", { name: /^Celeste/ }).click();
  const actions = page.getByRole("dialog");
  await actions
    .getByRole("button", { name: "Save to Backlog", exact: true })
    .click();
  await expect(current(page, "Backlog")).toBeVisible();
  await expect(updates(page)).toContainText("Celeste saved to Backlog");
  await expect(page).toHaveURL(/\?q=Celeste&year=2018&all=1$/);
  await expect(count(page, "Backlog (1)")).toBeVisible();
  await page.reload();
  await page.getByRole("option", { name: /^Celeste/ }).click();
  await expect(current(page, "Backlog")).toBeVisible();
  await closeCatalog(page);
  await count(page, "Backlog (1)").click();
  await expect(page).toHaveURL(/\/library\?status=backlog$/);
  await expect(page.getByRole("link", { name: /Celeste/ })).toBeVisible();
  await page.getByRole("link", { name: "Find a game", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toBeFocused();
  await selectCatalogGame(page, "Celeste");
  await actions
    .getByRole("button", { name: "Save to Wishlist", exact: true })
    .click();
  await expect(current(page, "Wishlist")).toBeVisible();
  await closeCatalog(page);
  await count(page, "Backlog (0)").click();
  await expect(page).toHaveURL(/\/library\?status=backlog$/);
  await expect(page.getByRole("link", { name: /Celeste/ })).toHaveCount(0);
});

test("discovery saves coordinate repeated games, labels and counts across all Home occurrences", async ({
  page,
  request,
}) => {
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  await signUp(page, request, uniqueUsername(`shelves`));
  const recent = page.getByRole("region", {
    name: "Recently released",
    exact: true,
    includeHidden: true,
  });
  const popular = page.getByRole("region", {
    name: "Recently trending",
    exact: true,
    includeHidden: true,
  });
  for (const [shelf, title, status] of [
    [recent, "Discovery One", "backlog"],
    [recent, "Discovery Two", "wishlist"],
    [popular, "Discovery Three", "backlog"],
    [popular, "Discovery Four", "wishlist"],
  ] as const) {
    await shelf
      .getByRole("button", {
        name: `Add to ${status} for ${title}`,
        exact: true,
      })
      .click();
    await expect(
      shelf.getByRole("button", {
        name: new RegExp(`Change status for ${title}$`),
      }),
    ).toBeVisible();
  }
  await expect(count(page, "Backlog (2)")).toBeVisible();
  const actions = await selectCatalogGame(page, "Discovery One");
  await expect(current(page, "Backlog")).toBeVisible();
  const playing = actions.getByRole("button", {
    name: "Save to Playing",
    exact: true,
  });
  await playing.click();
  await expect(current(page, "Playing")).toBeVisible();
  await expect(updates(page)).toContainText("Discovery One saved to Playing");
  await expect(playing).toBeFocused();
  await closeCatalog(page);
  await expect(recent.getByText("Playing", { exact: true })).toBeVisible();
  await expect(popular.getByText("Playing", { exact: true })).toBeVisible();
  await expect(count(page, "Backlog (1)")).toBeVisible();
  await page.reload();
  await selectCatalogGame(page, "Discovery One");
  await expect(current(page, "Playing")).toBeVisible();
  await closeCatalog(page);
  await page
    .getByRole("region", { name: "Playing", exact: true })
    .getByRole("button", { name: /Change status for Discovery One$/ })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Wishlist", exact: true })
    .click();
  await selectCatalogGame(page, "Discovery One");
  await expect(current(page, "Wishlist")).toBeVisible();
});

test("details visibly distinguish saving a Journal entry from adding a Playthrough", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername(`detail`));
  await page.goto("/games/celeste");
  const journal = page.getByRole("region", {
    name: "Game journal",
    exact: true,
  });
  await expect(
    journal.getByRole("button", {
      name: /(?:Add to Journal|Change Journal status) for /,
      exact: true,
    }),
  ).toContainText("Add to Journal");
  await expect(
    journal.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toHaveText(/Add playthrough/);
});

test("guest intent survives sign-in, restores filters and requires confirmation even without a visible candidate", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, uniqueUsername(`return`));
  await page.context().clearCookies();
  await page.goto("/?q=Celeste&year=2018&platform=PC&all=1&filters=1");
  await page.getByRole("option", { name: /^Celeste/ }).click();
  await page
    .getByRole("button", { name: "Save to Wishlist", exact: true })
    .click();
  const prompt = page.getByRole("region", {
    name: "Pending Journal save",
    exact: true,
  });
  await expect(prompt).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(prompt).toContainText("Sign in or create an account");
  await expect(
    prompt.getByRole("link", { name: "Sign in to continue", exact: true }),
  ).toBeFocused();
  // An intent resolves independently of candidates and incompatible filters, including reload.
  const destination = new URL(page.url());
  destination.searchParams.set("q", "Hades");
  await page.goto(destination.href);
  await expect(prompt).toBeVisible();
  await prompt
    .getByRole("link", { name: "Sign in to continue", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(prompt).toContainText("Current status: Not in your Journal");
  await expect(count(page, "Wishlist (0)")).toBeVisible();
  for (const [key, value] of Object.entries({
    q: "Hades",
    year: "2018",
    platform: "PC",
    all: "1",
    filters: "1",
  }))
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  await page.reload();
  await expect(
    prompt.getByRole("button", {
      name: "Confirm Celeste to Wishlist",
      exact: true,
    }),
  ).toBeFocused();
  await expect(count(page, "Wishlist (0)")).toBeVisible();
  await prompt
    .getByRole("button", { name: "Confirm Celeste to Wishlist", exact: true })
    .click();
  await expect(prompt).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByRole("status", { name: "Journal updates" }),
  ).toContainText("Celeste saved to Wishlist");
  await expect(updates(page)).toHaveCount(1);
  await expect(page).not.toHaveURL(/saveGame/);
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toHaveValue("Hades");
  await expect(page.getByLabel("Release year", { exact: true })).toHaveValue(
    "2018",
  );
  await expect(page.getByLabel("Platform", { exact: true })).toHaveValue("PC");
  await closeCatalog(page);
  await count(page, "Wishlist (1)").click();
  await expect(page.getByRole("link", { name: /Celeste/ })).toBeVisible();
});

test("pending saves block duplicate occurrences; failures before and after persistence reconcile truthfully", async ({
  page,
  request,
}) => {
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  await signUp(page, request, uniqueUsername(`network`));
  const actions = await selectCatalogGame(page, "Discovery One");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"] && !held) {
      held = true;
      await gate;
    }
    await route.continue();
  });
  await actions
    .getByRole("button", { name: "Save to Backlog", exact: true })
    .click();
  const popular = page.getByRole("region", {
    name: "Recently trending",
    exact: true,
    includeHidden: true,
  });
  await expect(
    popular.getByRole("button", {
      name: "Add to wishlist for Discovery One",
      exact: true,
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    actions
      .getByRole("button", { name: "Save to Backlog", exact: true })
      .locator("[data-action-state=pending]"),
  ).toBeVisible();
  await actions
    .getByRole("button", { name: "Save to Wishlist", exact: true })
    .click({ force: true });
  await expect(updates(page)).toHaveCount(1);
  release();
  await expect(current(page, "Backlog")).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  for (const afterPersistence of [false, true]) {
    await page.goto(`/?q=${afterPersistence ? "Celeste" : "Hades"}`);
    const title = afterPersistence ? "Celeste" : "Hades";
    await selectCatalogGame(page, title);
    let intercepted = false;
    await page.route("**/*", async (route) => {
      if (route.request().headers()["next-action"] && !intercepted) {
        intercepted = true;
        if (afterPersistence) await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await actions
      .getByRole("button", { name: "Save to Wishlist", exact: true })
      .click();
    if (afterPersistence) {
      await expect(current(page, "Wishlist")).toBeVisible();
      await expect(updates(page)).toContainText("Celeste saved to Wishlist");
    } else {
      await expect(
        actions.getByRole("button", {
          name: "Retry Hades to Wishlist",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        actions.getByText("Not in your Journal", { exact: true }),
      ).toBeVisible();
      await expect(updates(page)).toContainText("Hades: save not confirmed");
      await actions
        .getByRole("button", { name: "Retry Hades to Wishlist", exact: true })
        .click();
      await expect(current(page, "Wishlist")).toBeVisible();
    }
    await page.unrouteAll({ behavior: "wait" });
    await page.reload();
    await selectCatalogGame(page, title);
    await expect(current(page, "Wishlist")).toBeVisible();
  }
});

test("expired sessions offer sign-in recovery without a saved label", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername(`expired`));
  const actions = await selectCatalogGame(page, "Celeste");
  await page.context().clearCookies();
  await actions
    .getByRole("button", { name: "Save to Backlog", exact: true })
    .click();
  const prompt = page.getByRole("region", {
    name: "Pending Journal save",
    exact: true,
  });
  await expect(prompt).toHaveCount(1);
  await expect(prompt).toContainText("Sign in or create an account");
  await expect(count(page, "Backlog (1)")).toHaveCount(0);
  await prompt
    .getByRole("link", { name: "Sign in to continue", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
});

test("personal state can load or fail without presenting a confirmed unsaved game, and can be retried", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, uniqueUsername(`loading`));
  await request.post(supportUrl("/collection-delay"), {
    data: { email, milliseconds: 2000 },
  });
  await page.goto("/?q=Celeste", { waitUntil: "commit" });
  await page.getByRole("option", { name: /^Celeste/ }).click();
  const actions = page.getByRole("dialog");
  await expect(
    actions.getByText("Checking Journal status…", { exact: true }),
  ).toBeVisible();
  const save = actions.getByRole("button", {
    name: "Save to Backlog",
    exact: true,
  });
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(
    actions.getByText("Checking Journal status…", { exact: true }),
  ).toHaveCount(0);
  await request.post(supportUrl("/collection-delay"), {
    data: { email, fail: true },
  });
  await page.reload();
  await selectCatalogGame(page, "Celeste");
  await expect(
    actions.getByText("Journal status unavailable.", { exact: true }),
  ).toBeVisible();
  await expect(
    actions.getByRole("link", { name: "View game: Celeste", exact: true }),
  ).toBeVisible();
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await request.post(supportUrl("/collection-delay"), {
    data: { email, fail: false },
  });
  await actions
    .getByRole("button", { name: "Retry Journal for Celeste", exact: true })
    .click();
  await expect(save).toHaveAttribute("aria-disabled", "false");
  await save.click();
  await expect(current(page, "Backlog")).toBeVisible();
});

test("four Status labels are owner scoped; unchanged Played and status changes preserve Completion and private Playthroughs", async ({
  page,
  request,
  browser,
}) => {
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  const email = await signUp(page, request, uniqueUsername(`owner`));
  await seedSql(
    request,
    [
      `insert into journal_entry (user_id, game_id, status, completion_tag, updated_at) select u.id, v.id, v.status, v.tag, now() from "user" u cross join (values (201, 'played', 'completed'), (202, 'playing', null), (203, 'backlog', null), (204, 'wishlist', null)) v(id, status, tag) where u.email = $1`,
      `insert into playthrough (user_id, game_id, platform, started_on, notes) select id, 201, 'PC', '2026-01-02', 'Private summit route for owner' from "user" where email = $1`,
    ],
    [email],
  );
  await page.goto("/");
  for (const [title, status, label] of [
    ["Discovery One", "Played", "Played"],
    ["Discovery Two", "Playing", "Playing"],
    ["Discovery Three", "Backlog", "In backlog"],
    ["Discovery Four", "Wishlist", "Wishlisted"],
  ]) {
    for (const name of ["Recently released", "Recently trending"]) {
      const row = page
        .getByRole("region", { name, exact: true })
        .getByRole("listitem")
        .filter({
          has: page.getByRole("link", { name: new RegExp(`^${title}`) }),
        });
      await expect(row.getByText(label, { exact: true })).toBeVisible();
    }
    await selectCatalogGame(page, title);
    await expect(current(page, status)).toBeVisible();
    await closeCatalog(page);
  }
  const before = await (await page.request.get("/api/account/export")).json();
  const actions = await selectCatalogGame(page, "Discovery One");
  const played = actions.getByRole("button", {
    name: "Save to Played",
    exact: true,
  });
  await played.click();
  await expect(updates(page)).toContainText("Discovery One saved to Played");
  await expect(played).toBeFocused();
  expect(await (await page.request.get("/api/account/export")).json()).toEqual(
    before,
  );
  await actions
    .getByRole("button", { name: "Save to Backlog", exact: true })
    .click();
  await expect(current(page, "Backlog")).toBeVisible();
  await expect(count(page, "Backlog (2)")).toBeVisible();
  const after = await (await page.request.get("/api/account/export")).json();
  expect(after.playthroughs).toEqual(before.playthroughs);
  expect(
    after.entries.find((entry: { gameId: number }) => entry.gameId === 201),
  ).toMatchObject({ status: "backlog", completionTag: null });
  expect(await (await page.request.get("/?q=Discovery")).text()).not.toContain(
    "Private summit route for owner",
  );
  expect(
    await (await page.request.get("/api/games/search?q=Discovery")).text(),
  ).not.toMatch(/Private summit|completionTag|userId|notes/);
  const other = await browser.newPage({ baseURL: new URL(page.url()).origin });
  try {
    await signUp(other, request, uniqueUsername(`other`));
    const otherActions = await selectCatalogGame(other, "Discovery One");
    await otherActions
      .getByRole("button", { name: "Save to Wishlist", exact: true })
      .click();
    await expect(current(other, "Wishlist")).toBeVisible();
    await expect(count(other, "Backlog (0)")).toBeVisible();
    await page.reload();
    await selectCatalogGame(page, "Discovery One");
    await expect(current(page, "Backlog")).toBeVisible();
    await expect(count(page, "Backlog (2)")).toBeVisible();
  } finally {
    await other.close();
  }
});
test("signup and onboarding preserve Backlog intent; cancellation and repeated or invalid return visits never write", async ({
  page,
  request,
}) => {
  await page.goto("/?q=Celeste&platform=PC&all=1");
  await page.getByRole("option", { name: /^Celeste/ }).click();
  await page
    .getByRole("button", { name: "Save to Backlog", exact: true })
    .click();
  const prompt = page.getByRole("region", {
    name: "Pending Journal save",
    exact: true,
  });
  await expect(prompt).toBeVisible();
  const returnUrl = page.url();
  await prompt
    .getByRole("link", { name: "Create an account to continue", exact: true })
    .click();
  const username = uniqueUsername(`continue`);
  const email = `${username}@example.com`;
  await page.getByLabel("Name", { exact: true }).fill("Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();
  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const mail = mailbox.findLast(
    (message: { to: string }) => message.to === email,
  );
  await page.goto(mail.text.match(/https?:\S+/)[0]);
  await expect(page).toHaveURL(/\/onboarding\?returnTo=/);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    prompt.getByRole("button", {
      name: "Confirm Celeste to Backlog",
      exact: true,
    }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("platform")).toBe("PC");
  await expect(count(page, "Backlog (0)")).toBeVisible();
  await page.reload();
  await expect(
    prompt.getByRole("button", {
      name: "Confirm Celeste to Backlog",
      exact: true,
    }),
  ).toBeVisible();
  await prompt
    .getByRole("button", { name: "Cancel pending save", exact: true })
    .click();
  await expect(prompt).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Search games" }),
  ).toBeFocused();
  await expect(page).not.toHaveURL(/saveGame/);
  await page.goto("/games/celeste");
  await chooseStatus(page, "played");
  const before = await (await page.request.get("/api/account/export")).json();
  for (const destination of [
    returnUrl,
    returnUrl,
    "/?saveGame=1&saveSlug=celeste&saveStatus=remove",
    "/?saveGame=-1&saveSlug=celeste&saveStatus=backlog",
    "/?saveGame=201&saveSlug=celeste&saveStatus=backlog",
  ]) {
    await page.goto(destination);
    if (destination === returnUrl)
      await expect(prompt).toContainText("Current status: Played");
    else
      await expect(
        page.getByRole("button", { name: /^Confirm Celeste/ }),
      ).toHaveCount(0);
    await expect(count(page, "Backlog (0)")).toBeVisible();
    expect(
      await (await page.request.get("/api/account/export")).json(),
    ).toEqual(before);
  }
});

test("keyboard saves retain focus, menus restore it, and focused indicators contrast in both themes and forced colors", async ({
  page,
  request,
}) => {
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  await signUp(page, request, uniqueUsername(`keyboard`));
  await page.goto("/?q=Discovery%20One");
  const results = await selectCatalogGame(page, "Discovery One");
  const add = results.getByRole("button", {
    name: "Save to Backlog",
    exact: true,
  });
  await expect(add).not.toHaveAttribute("aria-haspopup");
  await add.focus();
  await page.keyboard.press("Space");
  await expect(current(page, "Backlog")).toBeVisible();
  await expect(add).toBeFocused();
  await closeCatalog(page);
  const change = page
    .getByRole("region", { name: "Recently released", exact: true })
    .getByRole("button", { name: /Change status for Discovery One$/ });
  await change.click();
  await expect(
    page.getByRole("menuitemradio", { name: "Backlog", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(change).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page
      .getByRole("region", { name: "Recently released", exact: true })
      .getByRole("link", { name: /^Discovery One/ }),
  ).toBeFocused();
  for (const theme of ["dark", "light"] as const) {
    await chooseTheme(page, theme);
    const cover = page
      .getByRole("region", { name: "Recently released", exact: true })
      .getByRole("link", { name: "Discovery One", exact: true });
    await cover.focus();
    const contrast = await cover.evaluate((node) => {
      const style = getComputedStyle(node);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      const luminance = (color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const channels = Array.from(ctx.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((value) => {
            const c = value / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const foreground = luminance(style.outlineColor);
      const background = luminance(
        getComputedStyle(document.body).backgroundColor,
      );
      return {
        ratio:
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        offset: parseFloat(style.outlineOffset),
        shadow: style.boxShadow,
      };
    });
    expect(contrast.ratio).toBeGreaterThanOrEqual(3);
    expect(contrast.width).toBeGreaterThanOrEqual(3);
    expect(contrast.offset).toBeGreaterThanOrEqual(3);
    expect(contrast.style).toBe("solid");
    expect(contrast.shadow).not.toBe("none");
    await change.focus();
    await page.keyboard.press("Enter");
    const choice = page.getByRole("menuitemradio", {
      name: "Backlog",
      exact: true,
    });
    await choice.focus();
    expect(
      await choice.evaluate((node) =>
        parseFloat(getComputedStyle(node).outlineWidth),
      ),
    ).toBeGreaterThanOrEqual(3);
    await page.keyboard.press("Escape");
  }
  await page.emulateMedia({ forcedColors: "active" });
  await change.focus();
  expect(
    await change.evaluate((node) => ({
      width: parseFloat(getComputedStyle(node).outlineWidth),
      style: getComputedStyle(node).outlineStyle,
    })),
  ).toMatchObject({ width: 3, style: "solid" });
  await page.getByRole("link", { name: "Backlog (1)", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/library\?status=backlog$/);
});

test("Home controls reflow with long titles and missing art at phone, tablet, desktop and 200% text", async ({
  page,
  request,
}) => {
  test.slow();
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  await signUp(page, request, uniqueUsername("reflow"));
  const title =
    "The Lantern Keeper's Extraordinarily Long Voyage Across the Shattered Archipelago: Definitive Edition";
  for (const theme of ["light", "dark"] as const) {
    await closeCatalog(page);
    await chooseTheme(page, theme);
    for (const [width, fontSize] of [
      [320, 16],
      [390, 16],
      [768, 16],
      [1440, 16],
      [320, 32],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}px`;
      }, fontSize);
      const actions = await selectCatalogGame(page, title);
      await actions
        .getByRole("button", { name: "Save to Wishlist", exact: true })
        .click();
      await expect(current(page, "Wishlist")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await actions.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      for (const button of await actions.getByRole("button").all()) {
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      }
      await closeCatalog(page);
      for (const name of ["Recently released", "Recently trending"]) {
        for (const row of await page
          .getByRole("region", { name, exact: true })
          .getByRole("listitem")
          .all()) {
          const link = await row.getByRole("link").boundingBox();
          for (const button of await row.getByRole("button").all()) {
            const rect = await button.boundingBox();
            expect(rect?.width).toBeGreaterThanOrEqual(44);
            expect(rect?.height).toBeGreaterThanOrEqual(44);
            expect(rect?.x).toBeGreaterThanOrEqual(0);
            expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(
              width,
            );
            expect(rect?.y).toBeGreaterThanOrEqual(
              (link?.y ?? 0) + (link?.height ?? 0),
            );
          }
        }
      }
      await page.evaluate(() =>
        document.documentElement.style.removeProperty("font-size"),
      );
    }
  }
});

test("saving the eighth contained search match preserves filters, active result and scroll position", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername(`contained`));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?q=Search%20Journey&year=2020&platform=PC&filters=1&all=1");
  const results = page.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("option")).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: /Show .*matches/ }),
  ).toHaveCount(0);
  const last = results.getByRole("option").last();
  await last.scrollIntoViewIfNeeded();
  await last.hover();
  const listPosition = await results.evaluate((el) => el.scrollTop);
  const position = await page.evaluate(() => scrollY);
  const url = page.url();
  await last.click();
  await page
    .getByRole("button", { name: "Save to Wishlist", exact: true })
    .click();
  await expect(current(page, "Wishlist")).toBeVisible();
  await page.getByRole("button", { name: "Back to results" }).click();
  await expect(results.getByRole("option")).toHaveCount(8);
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Release year", { exact: true })).toHaveValue(
    "2020",
  );
  await expect(page.getByLabel("Platform", { exact: true })).toHaveValue("PC");
  await expect(page).toHaveURL(url);
  expect(await results.evaluate((el) => el.scrollTop)).toBe(listPosition);
  expect(await page.evaluate(() => scrollY)).toBe(position);
});
