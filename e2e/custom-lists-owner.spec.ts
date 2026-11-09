import { expect, test } from "@playwright/test";
import { openCatalog, selectCatalogGame } from "./support/catalog";
import {
  closeListPanel,
  openListOptions,
  openListPanel,
} from "./support/list-editor";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";
import { snap } from "./support/snap";
import { supportUrl } from "./support/url";

test("lost membership and delete responses reconcile before another mutation", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("lists_owner_ambiguous"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Ambiguous operations");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Add games");
  await selectCatalogGame(page, "Celeste");
  const add = page.getByRole("button", {
    name: "Add to list: Celeste",
    exact: true,
  });
  await expect(add).toBeVisible();
  for (const kind of ["add", "delete"]) {
    let intercepted = false;
    await page.route("**/*", async (route) => {
      if (!intercepted && route.request().headers()["next-action"]) {
        intercepted = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    if (kind === "add") await add.click();
    else {
      page.once("dialog", (dialog) => dialog.accept());
      await openListOptions(page);
      await page
        .getByRole("menuitem", { name: "Delete list", exact: true })
        .click();
    }
    await expect(
      page.getByRole("alert").filter({ hasText: "Couldn’t confirm the save" }),
    ).toBeVisible();
    if (kind === "add") {
      await closeListPanel(page);
      await expect(
        page.getByRole("button", { name: "Add games", exact: true }),
      ).toBeFocused();
      await openListPanel(page, "Add games");
      await expect(
        page.getByRole("button", { name: "Refresh saved list", exact: true }),
      ).toBeVisible();
    }
    await openListOptions(page);
    await expect(
      page.getByRole("menuitem", { name: "Delete list", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.unrouteAll({ behavior: "wait" });
    await page
      .getByRole("button", { name: "Refresh saved list", exact: true })
      .click();
    if (kind === "add") {
      await openListPanel(page, "Add games");
      await selectCatalogGame(page, "Celeste");
      await expect(
        page.getByRole("button", {
          name: "Already in list: Celeste",
          exact: true,
        }),
      ).toBeDisabled();
    } else
      await expect(
        page.getByRole("link", { name: "Return to your lists", exact: true }),
      ).toBeVisible();
  }
  await page
    .getByRole("link", { name: "Return to your lists", exact: true })
    .click();
  await expect(
    page.getByText("No lists yet").filter({ visible: true }),
  ).toBeVisible();
});

test("an empty public list can be created explicitly and has generic owner metadata", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("lists_owner_public_create"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Public from creation");
  await page
    .getByRole("radio", {
      name: "Public — visible to anyone, and listed when your profile is Public",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Visibility and sharing");
  await expect(
    page.getByRole("textbox", { name: "Public list URL", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 games", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page).toHaveTitle(/Manage list/);
  expect(await page.title()).not.toContain("Public from creation");
});

test("owner routes and direct mutations reject another actor, and a switched-account tab drops private state", async ({
  page,
  request,
  browser,
  context,
}) => {
  await signUp(page, request, uniqueUsername("lists_owner_guard"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Distinct private owner title");
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("Distinct private description");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("button", { name: "Save details", exact: true }),
  ).toBeVisible();
  const url = page.url();
  const originalCookies = await context.cookies();
  const mutation = page.waitForRequest((r) => !!r.headers()["next-action"]);
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  const action = await mutation;
  await expect(
    page.getByRole("dialog", { name: "Details saved." }),
  ).toBeVisible();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signUp(other, request, uniqueUsername("lists_other_guard"));
  const session = await (
    await other.request.get("/api/auth/get-session")
  ).json();
  const args = JSON.parse(action.postData() as string);
  args[0] = session.user.id;
  args[3] = { title: "Forged title", description: "Forged description" };
  const response = await other.request.post(url, {
    headers: {
      "next-action": action.headers()["next-action"],
      "content-type": action.headers()["content-type"],
      origin: new URL(url).origin,
    },
    data: JSON.stringify(args),
  });
  const payload = await response.text();
  expect(payload).toContain("List not found");
  expect(payload).not.toContain("Distinct private");
  const html = await (await other.request.get(url)).text();
  expect(html).not.toContain("Distinct private");
  await openListPanel(page, "Edit list");
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Draft belongs to original account");
  await context.clearCookies();
  await context.addCookies(await otherContext.cookies());
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in to continue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveCount(0);
  await context.clearCookies();
  await context.addCookies(originalCookies);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Distinct private owner title",
      exact: true,
    }),
  ).toBeVisible();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveValue("Draft belongs to original account");
  await otherContext.close();
});

test("owner read and search failures stay distinct from empty states and can be retried on a narrow screen", async ({
  page,
  request,
}) => {
  const email = await signUp(
    page,
    request,
    uniqueUsername("lists_owner_unavailable"),
  );
  await request.post(supportUrl("/collection-delay"), {
    data: { email, fail: true },
  });
  await page.goto("/lists");
  await expect(
    page.getByRole("alert").filter({ hasText: "Lists are unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("No lists yet").filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await request.post(supportUrl("/collection-delay"), {
    data: { email, fail: false },
  });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Long collection ".repeat(6));
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 760 });
  await openListPanel(page, "Add games");
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toBeVisible();
  await page.route("**/api/games/search?**", (route) =>
    route.fulfill({ status: 503 }),
  );
  await openListPanel(page, "Add games");
  await (await openCatalog(page)).fill("Celeste");
  await expect(
    page.getByRole("alert").filter({ hasText: "Search isn’t working" }),
  ).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("option", { name: /^Celeste/ }).click();
  await page
    .getByRole("button", { name: "Add to list: Celeste", exact: true })
    .click();
  await closeListPanel(page);
  await expect(
    page.getByText("1 game", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("keyboard moves cross game pages with focus and preserve URL state, and owner lists paginate", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, request, uniqueUsername("lists_owner_pages"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Paged collection");
  await page.getByRole("button", { name: "Create list", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
  const path = new URL(page.url()).pathname;
  const id = path.split("/").at(-1) as string;
  await seedSql(
    request,
    [
      `insert into game (id, title, slug, genres, platforms, synced_at) select n, 'List game ' || (n - 860000), 'list-game-' || n, '{}', '{PC}', now() from generate_series(860000, 860049) n on conflict do nothing`,
      `insert into list_entry (list_id, game_id, position) select $1::uuid, n, n - 860000 from generate_series(860000, 860049) n`,
      `insert into custom_list (id, user_id, title, submission_id) select md5('owner-pages-' || n)::uuid, user_id, 'Other collection ' || n, md5('owner-submission-' || n)::uuid from custom_list cross join generate_series(1, 48) n where id = $1::uuid`,
    ],
    [id],
  );
  await page.goto(`${path}?kept=1`);
  const games = page.getByRole("list", { name: "List games", exact: true });
  await closeListPanel(page);
  await expect(games.getByRole("listitem")).toHaveCount(48);
  await closeListPanel(page);
  const move = games.getByRole("button", {
    name: "Move List game 47 down",
    exact: true,
  });
  await move.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/kept=1&gamesPage=2$/);
  await closeListPanel(page);
  await expect(
    games.getByRole("link", { name: "List game 47", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await snap(page, testInfo, "owner-mobile-keyboard-page-two");
  await closeListPanel(page);
  await games
    .getByRole("button", { name: "Move List game 47 up", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?kept=1$/);
  await closeListPanel(page);
  await expect(
    games.getByRole("link", { name: "List game 47", exact: true }),
  ).toBeFocused();
  await page.reload();
  await closeListPanel(page);
  await expect(games.getByRole("link").last()).toHaveText("List game 47");
  await page
    .getByRole("navigation", { name: "List games pages", exact: true })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await closeListPanel(page);
  await games
    .getByRole("button", { name: "Remove List game 48 from list", exact: true })
    .click();
  await closeListPanel(page);
  await expect(
    games.getByRole("link", { name: "List game 49", exact: true }),
  ).toBeFocused();
  await closeListPanel(page);
  await games
    .getByRole("button", { name: "Remove List game 49 from list", exact: true })
    .click();
  await expect(page).toHaveURL(/\?kept=1$/);
  await closeListPanel(page);
  await expect(
    games.getByRole("link", { name: "List game 47", exact: true }),
  ).toBeFocused();
  await page.goto("/lists?kept=1");
  const pages = page.getByRole("navigation", {
    name: "Your lists pages",
    exact: true,
  });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/kept=1&listsPage=2$/);
  await expect(
    page
      .getByRole("group", { name: "Your lists", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\?kept=1$/);
  await page.goForward();
  await expect(page).toHaveURL(/listsPage=2$/);
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Your lists", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
});

test("signup and username onboarding return to the selected game without mutating during authentication", async ({
  page,
  request,
}) => {
  await page.goto("/games/celeste?addToList=1");
  await page
    .getByRole("link", {
      name: "Sign in to add Celeste to a list",
      exact: true,
    })
    .click();
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  const username = uniqueUsername("lists_owner_onboard");
  const email = `${username}@example.com`;
  await page.getByLabel("Name", { exact: true }).fill("Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();
  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const mail = mailbox.findLast((mail: { to: string }) => mail.to === email);
  await page.goto(mail.text.match(/https?:\S+/)[0]);
  await expect(page).toHaveURL(/\/onboarding\?returnTo=/);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/games\/celeste\?addToList=1$/);
  await expect(
    page.getByRole("dialog", { name: "Add to list", exact: true }),
  ).toContainText("No lists yet");
  await page.goto("/library");
  await expect(
    page.getByText("Your library is empty.").filter({ visible: true }),
  ).toBeVisible();
});

test("game-page picker retains the selected game through sign-in and no-lists creation", async ({
  page,
  request,
}) => {
  const email = await signUp(
    page,
    request,
    uniqueUsername("lists_owner_picker"),
  );
  await page.context().clearCookies();
  await page.goto("/games/celeste");
  await expect(
    page.getByRole("button", { name: "Add to list", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  await page
    .getByRole("link", {
      name: "Sign in to add Celeste to a list",
      exact: true,
    })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(page).toHaveURL(/\/games\/celeste\?addToList=1$/);
  const picker = page.getByRole("dialog", {
    name: "Add to list",
    exact: true,
  });
  await expect(picker).toContainText("No lists yet");
  await picker
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("From a game page");
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  const trigger = page.getByRole("button", {
    name: "Add to list",
    exact: true,
  });
  await expect(trigger).toBeFocused();
  await expect(page).not.toHaveURL(/addToList/);
  await trigger.click();
  await expect(
    picker.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveValue("From a game page");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/games/celeste**", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  await picker
    .getByRole("button", { name: "Create list and add Celeste", exact: true })
    .click();
  try {
    await expect(
      picker.getByRole("button", { name: "Close", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(picker).toBeVisible();
  } finally {
    release();
  }
  await expect(
    picker.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveCount(0);
  await expect(
    picker.getByRole("button", { name: "Refresh lists", exact: true }),
  ).toHaveCount(0);
  await expect(
    picker.getByRole("button", {
      name: "Already in list: Celeste in From a game page",
      exact: true,
    }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    picker.getByRole("button", {
      name: "Already in list: Celeste in From a game page",
      exact: true,
    }),
  ).toBeDisabled();
  await page.goto("/lists");
  await page
    .getByRole("link", { name: "From a game page", exact: true })
    .click();
  await expect(
    page
      .getByRole("list", { name: "List games", exact: true })
      .getByRole("link"),
  ).toHaveText(["Celeste"]);
});

test("expired sessions preserve metadata through sign-in and a lost save requires reconciliation", async ({
  page,
  request,
  context,
}) => {
  const email = await signUp(
    page,
    request,
    uniqueUsername("lists_owner_session"),
  );
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Original title");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("button", { name: "Save details", exact: true }),
  ).toBeVisible();
  const url = page.url();
  await openListPanel(page, "Edit list");
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Recover after sign-in");
  await context.clearCookies();
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in to continue", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Sign in to continue", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(page).toHaveURL(url);
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveValue("Recover after sign-in");
  let intercepted = false;
  await page.route("**/*", async (route) => {
    if (!intercepted && route.request().headers()["next-action"]) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn’t confirm the save" }),
  ).toBeVisible();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("button", { name: "Save details", exact: true }),
  ).toBeDisabled();
  await page.unrouteAll({ behavior: "wait" });
  await page
    .getByRole("button", { name: "Refresh saved list", exact: true })
    .click();
  await closeListPanel(page);
  await expect(
    page.getByRole("heading", { name: "Recover after sign-in", exact: true }),
  ).toBeVisible();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("button", { name: "Save details", exact: true }),
  ).toBeEnabled();
});

test("a lost creation response retains the draft and retry key across reload without creating another list", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("lists_owner_retry"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Uncertain creation");
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("Keep this draft");
  let intercepted = false;
  await page.route("**/*", async (route) => {
    if (!intercepted && route.request().headers()["next-action"]) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn’t confirm creation" }),
  ).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveValue("Uncertain creation");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
  await page.goto("/lists");
  await expect(
    page.getByRole("link", { name: "Uncertain creation", exact: true }),
  ).toHaveCount(1);
});

test("stale metadata cannot republish a list and refresh keeps the local draft for explicit retry", async ({
  page,
  request,
  context,
}) => {
  await signUp(page, request, uniqueUsername("lists_owner_stale"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Concurrent list");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  for (const title of ["Celeste", "Hades"]) {
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
  await openListPanel(page, "Visibility and sharing");
  await page.getByRole("button", { name: "Publish list", exact: true }).click();
  await openListPanel(page, "Visibility and sharing");
  await expect(
    page.getByRole("button", { name: "Make private", exact: true }),
  ).toBeEnabled();
  const other = await context.newPage();
  await other.goto(page.url());
  await openListPanel(page, "Edit list");
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("My retained draft");
  await openListPanel(other, "Visibility and sharing");
  await other
    .getByRole("button", { name: "Make private", exact: true })
    .click();
  await openListPanel(other, "Visibility and sharing");
  await expect(
    other.getByRole("button", { name: "Publish list", exact: true }),
  ).toBeEnabled();
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "This list changed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh saved list", exact: true }),
  ).toBeVisible();
  await closeListPanel(page);
  await expect(
    page.getByRole("button", { name: "Move Celeste down", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Refresh saved list", exact: true })
    .click();
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("textbox", { name: "List title", exact: true }),
  ).toHaveValue("My retained draft");
  await openListPanel(page, "Visibility and sharing");
  await expect(
    page.getByRole("button", { name: "Publish list", exact: true }),
  ).toBeEnabled();
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My retained draft", exact: true }),
  ).toBeVisible();
  await openListPanel(page, "Visibility and sharing");
  await expect(
    page.getByRole("button", { name: "Publish list", exact: true }),
  ).toBeVisible();
  await other.close();
});

test("publishing is separate from metadata, links survive renames, clipboard denial falls back, and delete needs confirmation", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("lists_owner_share");
  await signUp(page, request, username);
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Share me");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Visibility and sharing");
  await expect(
    page.getByRole("button", { name: "Publish list", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Public list URL", exact: true }),
  ).toHaveCount(0);
  await openListPanel(page, "Edit list");
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Unsaved draft");
  await openListPanel(page, "Visibility and sharing");
  await page.getByRole("button", { name: "Publish list", exact: true }).click();
  await closeListPanel(page);
  await expect(
    page.getByRole("heading", { name: "Share me", exact: true }),
  ).toBeVisible();
  await openListPanel(page, "Visibility and sharing");
  const sharing = page.getByRole("textbox", {
    name: "Public list URL",
    exact: true,
  });
  const url = await sharing.inputValue();
  expect(url).toMatch(
    new RegExp(`^https://shelve[.]games/u/${username}/lists/[a-f0-9-]+$`),
  );
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Unsaved draft", exact: true }),
  ).toBeVisible();
  await openListPanel(page, "Visibility and sharing");
  await expect(sharing).toHaveValue(url);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Select the public list URL" }),
  ).toBeVisible();
  await expect(sharing).toBeFocused();
  expect(
    await sharing.evaluate(
      (input: HTMLInputElement) =>
        (input.selectionEnd ?? 0) - (input.selectionStart ?? 0),
    ),
  ).toBe(url.length);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => Reflect.deleteProperty(navigator, "clipboard"));
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not copy" }),
  ).toHaveCount(0);
  await openListPanel(page, "Visibility and sharing");
  await page.getByRole("button", { name: "Make private", exact: true }).click();
  await expect(sharing).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await openListOptions(page);
  await page
    .getByRole("menuitem", { name: "Delete list", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Unsaved draft", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await openListOptions(page);
  await page
    .getByRole("menuitem", { name: "Delete list", exact: true })
    .click();
  await expect(page).toHaveURL(/\/lists$/);
  await expect(
    page.getByText("No lists yet").filter({ visible: true }),
  ).toBeVisible();
});

test("Catalog selection appends, deduplicates, moves and removes without recording a Journal entry", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("lists_owner_catalog"));
  await page.goto("/lists");
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .fill("Catalog only");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await openListPanel(page, "Add games");
  await expect(
    page.getByRole("combobox", { name: "Search games", exact: true }),
  ).toBeVisible();
  const url = page.url();
  const search = page.getByRole("dialog", { name: "Add games", exact: true });
  await openListPanel(page, "Add games");
  await selectCatalogGame(page, "Celeste");
  await search
    .getByRole("button", { name: "Add to list: Celeste", exact: true })
    .click();
  await expect(
    search.getByRole("button", {
      name: "Already in list: Celeste",
      exact: true,
    }),
  ).toBeDisabled();
  await openListPanel(page, "Add games");
  await selectCatalogGame(page, "Hades");
  await search
    .getByRole("button", { name: "Add to list: Hades", exact: true })
    .click();
  const games = page.getByRole("list", { name: "List games", exact: true });
  await closeListPanel(page);
  await expect(games.getByRole("link")).toHaveText(["Celeste", "Hades"]);
  await closeListPanel(page);
  await games
    .getByRole("button", { name: "Move Hades up", exact: true })
    .click();
  await closeListPanel(page);
  await expect(games.getByRole("link")).toHaveText(["Hades", "Celeste"]);
  await closeListPanel(page);
  await games
    .getByRole("button", { name: "Remove Hades from list", exact: true })
    .click();
  await closeListPanel(page);
  await expect(
    games.getByRole("link", { name: "Celeste", exact: true }),
  ).toBeFocused();
  await page.goto("/library");
  await expect(
    page
      .getByText("Your library is empty.", { exact: false })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.goto(url);
  await expect(
    page
      .getByRole("list", { name: "List games", exact: true })
      .getByRole("link"),
  ).toHaveText(["Celeste"]);
});

test("owner creates an empty private list, saves metadata, and keeps duplicate titles distinct", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("lists_owner_create"));
  await page
    .getByRole("navigation", { name: "Main", exact: true })
    .getByRole("link", { name: "Lists", exact: true })
    .click();
  await expect(page.getByText("No lists yet")).toBeVisible();
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .filter({ visible: true })
    .fill("Friends");
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .filter({ visible: true })
    .fill("First line\nSecond line");
  await expect(page.getByLabel("Private — only you")).toBeChecked();
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
  const first = page.url();
  await expect(page.getByText("0 games", { exact: true })).toBeVisible();
  await openListPanel(page, "Edit list");
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .filter({ visible: true })
    .fill("Friends renamed");
  await openListPanel(page, "Edit list");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Details saved." }),
  ).toBeVisible();
  await page.reload();
  await openListPanel(page, "Edit list");
  await expect(
    page
      .getByRole("textbox", { name: "List title", exact: true })
      .filter({ visible: true }),
  ).toHaveValue("Friends renamed");
  await openListPanel(page, "Edit list");
  await expect(
    page.getByRole("textbox", { name: "Description (optional)", exact: true }),
  ).toHaveValue("First line\nSecond line");
  await page.goto("/lists");
  await expect(
    page.getByRole("link", { name: "Friends renamed", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "List title", exact: true })
    .filter({ visible: true })
    .fill("Friends renamed");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
  expect(page.url()).not.toBe(first);
});
