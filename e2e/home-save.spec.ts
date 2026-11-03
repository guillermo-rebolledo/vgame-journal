import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { seedSql } from "./support/seed-sql";
import { signUp } from "./support/sign-up";
import { supportUrl } from "./support/url";

test("Home saves a search result without losing browsing context and opens filtered Backlog", async ({
  page,
  request,
}) => {
  await signUp(page, request, `quick_${Date.now()}`);
  await expect(
    page.getByRole("link", { name: "Backlog (0)", exact: true }),
  ).toBeVisible();
  await page.goto("/?q=Celeste&year=2018&all=1");
  const result = page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .first();
  await result
    .getByRole("button", { name: "Add Celeste to backlog", exact: true })
    .click();
  await expect(result.getByText("In backlog", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Journal updates" }),
  ).toContainText("Celeste saved to Backlog");
  await expect(page).toHaveURL(/\?q=Celeste&year=2018&all=1$/);
  await expect(
    page.getByRole("link", { name: "Backlog (1)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(result.getByText("In backlog", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Backlog (1)", exact: true }).click();
  await expect(page).toHaveURL(/\/library\?status=backlog$/);
  await expect(page.getByRole("link", { name: /Celeste/ })).toBeVisible();
  await page.getByRole("link", { name: "Find a game", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
  await result
    .getByRole("button", { name: "Change status for Celeste", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Wishlist", exact: true })
    .click();
  await page.getByRole("link", { name: "Backlog (0)", exact: true }).click();
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
  await signUp(page, request, `shelves_${Date.now()}`);
  const recent = page.getByRole("region", {
    name: "Recently released",
    exact: true,
  });
  const popular = page.getByRole("region", {
    name: "Popular right now",
    exact: true,
  });
  for (const [shelf, title, status] of [
    [recent, "Discovery One", "backlog"],
    [recent, "Discovery Two", "wishlist"],
    [popular, "Discovery Three", "backlog"],
    [popular, "Discovery Four", "wishlist"],
  ] as const) {
    await shelf
      .getByRole("button", { name: `Add ${title} to ${status}`, exact: true })
      .click();
    await expect(
      shelf.getByRole("button", {
        name: `Change status for ${title}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "Backlog (2)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search games" })
    .fill("Discovery One");
  const search = page.getByRole("list", { name: "Search results" });
  await expect(search.getByText("In backlog", { exact: true })).toBeVisible();
  await search
    .getByRole("button", {
      name: "Change status for Discovery One",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: "Backlog", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page
    .getByRole("menuitemradio", { name: "Playing", exact: true })
    .click();
  await expect(search.getByText("Playing", { exact: true })).toBeVisible();
  await expect(recent.getByText("Playing", { exact: true })).toBeVisible();
  await expect(popular.getByText("Playing", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Backlog (1)", exact: true }),
  ).toBeVisible();
  await expect(
    search.getByRole("button", { name: "Change status for Discovery One" }),
  ).toBeFocused();
  await page.reload();
  await expect(search.getByText("Playing", { exact: true })).toBeVisible();
  await page
    .getByRole("region", { name: "Playing", exact: true })
    .getByRole("button", {
      name: "Change status for Discovery One",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Wishlist", exact: true })
    .click();
  await expect(search.getByText("Wishlisted", { exact: true })).toBeVisible();
  await expect(
    search.getByRole("button", {
      name: "Change status for Discovery One",
      exact: true,
    }),
  ).toBeFocused();
});

test("details visibly distinguish saving a Journal entry from adding a Playthrough", async ({
  page,
  request,
}) => {
  await signUp(page, request, `detail_${Date.now()}`);
  await page.goto("/games/celeste");
  const journal = page.getByRole("region", {
    name: "Game journal",
    exact: true,
  });
  await expect(
    journal.getByRole("button", {
      name: /^(?:Add to Journal|Change Journal status) for /,
      exact: true,
    }),
  ).toContainText("Add to Journal");
  await expect(
    journal.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toHaveText(/Add playthrough/);
});

test("guest intent survives sign-in, restores filters and requires confirmation even without a visible card", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, `return_${Date.now()}`);
  await page.context().clearCookies();
  await page.goto("/?q=Celeste&year=2018&all=1");
  await page
    .getByRole("button", { name: "Add Celeste to wishlist", exact: true })
    .click();
  const prompt = page.getByRole("region", {
    name: "Pending Journal save",
    exact: true,
  });
  await expect(prompt).toContainText("Sign in or create an account");
  await expect(
    prompt.getByRole("link", { name: "Sign in to continue", exact: true }),
  ).toBeFocused();
  await page.reload();
  await prompt
    .getByRole("link", { name: "Sign in to continue", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(
    page.getByRole("searchbox", { name: "Search games" }),
  ).toHaveValue("Celeste");
  await expect(page.getByLabel("Release year", { exact: true })).toHaveValue(
    "2018",
  );
  await expect(prompt).toContainText("Current status: Not in your Journal");
  await expect(
    page.getByRole("link", { name: "Backlog (0)", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search games" }).fill("Hades");
  await expect(
    page
      .getByRole("list", { name: "Search results" })
      .getByRole("link", { name: /^Hades/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    prompt.getByRole("button", {
      name: "Confirm Celeste to Wishlist",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Wishlist (0)", exact: true }),
  ).toBeVisible();
  await prompt
    .getByRole("button", { name: "Confirm Celeste to Wishlist", exact: true })
    .click();
  await expect(prompt).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Change status for Celeste",
      exact: true,
    }),
  ).toBeFocused();
  await expect(page).not.toHaveURL(/saveGame/);
  await page.getByRole("link", { name: "Wishlist (1)", exact: true }).click();
  await expect(page.getByRole("link", { name: /Celeste/ })).toBeVisible();
});

test("pending saves block duplicate occurrences; failures before and after persistence reconcile truthfully", async ({
  page,
  request,
}) => {
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  await signUp(page, request, `network_${Date.now()}`);
  await page.goto("/?q=Discovery%20One");
  const search = page.getByRole("list", { name: "Search results" });
  await expect(
    search.getByRole("button", {
      name: "Add Discovery One to backlog",
      exact: true,
    }),
  ).toBeVisible();
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
  await search
    .getByRole("button", { name: "Add Discovery One to backlog", exact: true })
    .click();
  const popular = page.getByRole("region", {
    name: "Popular right now",
    exact: true,
  });
  await expect(
    popular.getByRole("button", {
      name: "Add Discovery One to wishlist",
      exact: true,
    }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    search.getByText("Saving Discovery One to Backlog…", { exact: true }),
  ).toBeVisible();
  await popular
    .getByRole("button", { name: "Add Discovery One to wishlist", exact: true })
    .click({ force: true });
  release();
  await expect(search.getByText("In backlog", { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  for (const afterPersistence of [false, true]) {
    await page.goto(`/?q=${afterPersistence ? "Celeste" : "Hades"}`);
    const title = afterPersistence ? "Celeste" : "Hades";
    await expect(
      search.getByRole("button", {
        name: `Add ${title} to wishlist`,
        exact: true,
      }),
    ).toBeVisible();
    let intercepted = false;
    await page.route("**/*", async (route) => {
      if (route.request().headers()["next-action"] && !intercepted) {
        intercepted = true;
        if (afterPersistence) await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await search
      .getByRole("button", { name: `Add ${title} to wishlist`, exact: true })
      .click();
    if (afterPersistence) {
      await expect(
        search.getByText("Wishlisted", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("status", { name: "Journal updates" }),
      ).toContainText("Celeste saved to Wishlist");
    } else {
      await expect(
        search.getByRole("button", {
          name: "Retry Hades to Wishlist",
          exact: true,
        }),
      ).toBeVisible();
      await expect(search.getByText("Wishlisted", { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("status", { name: "Journal updates" }),
      ).toContainText("Hades: save not confirmed");
      await search
        .getByRole("button", { name: "Retry Hades to Wishlist", exact: true })
        .click();
      await expect(
        search.getByText("Wishlisted", { exact: true }),
      ).toBeVisible();
    }
    await page.unrouteAll({ behavior: "wait" });
    await page.reload();
    await expect(search.getByText("Wishlisted", { exact: true })).toBeVisible();
  }
});

test("expired sessions offer sign-in recovery without a saved label", async ({
  page,
  request,
}) => {
  await signUp(page, request, `expired_${Date.now()}`);
  await page.goto("/?q=Celeste");
  const results = page.getByRole("list", { name: "Search results" });
  const save = results.getByRole("button", {
    name: "Add Celeste to backlog",
    exact: true,
  });
  await expect(save).toBeVisible();
  await page.context().clearCookies();
  await save.click();
  await expect(
    page.getByRole("region", { name: "Pending Journal save", exact: true }),
  ).toContainText("Sign in or create an account");
  await expect(results.getByText("In backlog", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Backlog (1)", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Sign in to continue", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
});

test("personal state can load or fail without presenting a confirmed unsaved game, and can be retried", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, `loading_${Date.now()}`);
  await request.post(supportUrl("/collection-delay"), {
    data: { email, milliseconds: 2000 },
  });
  await page.goto("/?q=Celeste", { waitUntil: "commit" });
  const results = page.getByRole("list", { name: "Search results" });
  await expect(
    results.getByText("Checking Journal status…", { exact: true }),
  ).toBeVisible();
  await expect(
    results.getByRole("button", {
      name: "Add Celeste to backlog",
      exact: true,
    }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    results.getByText("Checking Journal status…", { exact: true }),
  ).toHaveCount(0);
  await request.post(supportUrl("/collection-delay"), {
    data: { email, fail: true },
  });
  await page.reload();
  await expect(
    results.getByText("Journal status unavailable.", { exact: true }),
  ).toBeVisible();
  await expect(results.getByRole("link", { name: /^Celeste/ })).toBeVisible();
  await expect(
    results.getByRole("button", {
      name: "Add Celeste to backlog",
      exact: true,
    }),
  ).toHaveAttribute("aria-disabled", "true");
  await request.post(supportUrl("/collection-delay"), {
    data: { email, fail: false },
  });
  await results
    .getByRole("button", { name: "Retry Journal for Celeste", exact: true })
    .click();
  await expect(
    results.getByRole("button", {
      name: "Add Celeste to backlog",
      exact: true,
    }),
  ).toHaveAttribute("aria-disabled", "false");
  await results
    .getByRole("button", { name: "Add Celeste to backlog", exact: true })
    .click();
  await expect(results.getByText("In backlog", { exact: true })).toBeVisible();
});

test("four Status labels are owner scoped; unchanged Played and status changes preserve Completion and private Playthroughs", async ({
  page,
  request,
  browser,
}) => {
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  const email = await signUp(page, request, `owner_${Date.now()}`);
  await seedSql(
    request,
    [
      `insert into journal_entry (user_id, game_id, status, completion_tag, updated_at) select u.id, v.id, v.status, v.tag, now() from "user" u cross join (values (201, 'played', 'completed'), (202, 'playing', null), (203, 'backlog', null), (204, 'wishlist', null)) v(id, status, tag) where u.email = $1`,
      `insert into playthrough (user_id, game_id, platform, started_on, notes) select id, 201, 'PC', '2026-01-02', 'Private summit route for owner' from "user" where email = $1`,
    ],
    [email],
  );
  await page.goto("/?q=Discovery");
  const results = page.getByRole("list", { name: "Search results" });
  const recent = page.getByRole("region", {
    name: "Recently released",
    exact: true,
  });
  const popular = page.getByRole("region", {
    name: "Popular right now",
    exact: true,
  });
  for (const [title, label] of [
    ["Discovery One", "Played"],
    ["Discovery Two", "Playing"],
    ["Discovery Three", "In backlog"],
    ["Discovery Four", "Wishlisted"],
  ]) {
    for (const list of [results, recent, popular]) {
      const row = list.getByRole("listitem").filter({
        has: page.getByRole("link", { name: new RegExp(`^${title}`) }),
      });
      await expect(row.getByText(label, { exact: true })).toBeVisible();
    }
  }
  const before = await (await page.request.get("/api/account/export")).json();
  const change = results.getByRole("button", {
    name: "Change status for Discovery One",
    exact: true,
  });
  await change.click();
  await page
    .getByRole("menuitemradio", { name: "Played", exact: true })
    .click();
  await expect(change).toBeFocused();
  const unchanged = await (
    await page.request.get("/api/account/export")
  ).json();
  expect(unchanged).toEqual(before);
  await change.click();
  await page
    .getByRole("menuitemradio", { name: "Backlog", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Backlog (2)", exact: true }),
  ).toBeVisible();
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
    await signUp(other, request, `other_${Date.now()}`);
    await other.goto("/?q=Discovery%20One");
    const otherResults = other.getByRole("list", { name: "Search results" });
    await otherResults
      .getByRole("button", {
        name: "Add Discovery One to wishlist",
        exact: true,
      })
      .click();
    await expect(
      otherResults.getByText("Wishlisted", { exact: true }),
    ).toBeVisible();
    await expect(
      other.getByRole("link", { name: "Backlog (0)", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      results
        .getByRole("listitem")
        .filter({ has: page.getByRole("link", { name: /^Discovery One/ }) })
        .getByText("In backlog", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Backlog (2)", exact: true }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("signup and onboarding preserve Backlog intent; cancellation and repeated or invalid return visits never write", async ({
  page,
  request,
}) => {
  await page.goto("/?q=Celeste&platform=PC&all=1");
  await page
    .getByRole("button", { name: "Add Celeste to backlog", exact: true })
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
  const username = `continue_${Date.now()}`;
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
  await expect(page.getByLabel("Platform", { exact: true })).toHaveValue("PC");
  await expect(
    page.getByRole("link", { name: "Backlog (0)", exact: true }),
  ).toBeVisible();
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
    page.getByRole("searchbox", { name: "Search games" }),
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
    await expect(
      page.getByRole("link", { name: "Backlog (0)", exact: true }),
    ).toBeVisible();
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
  await signUp(page, request, `keyboard_${Date.now()}`);
  await page.goto("/?q=Discovery%20One");
  const results = page.getByRole("list", { name: "Search results" });
  const add = results.getByRole("button", {
    name: "Add Discovery One to backlog",
    exact: true,
  });
  await expect(add).not.toHaveAttribute("aria-haspopup");
  await add.focus();
  await page.keyboard.press("Space");
  const change = results.getByRole("button", {
    name: "Change status for Discovery One",
    exact: true,
  });
  await expect(change).toBeFocused();
  await expect(results.getByText("In backlog", { exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "Backlog", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(change).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    results.getByRole("link", { name: /^Discovery One/ }),
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
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  await signUp(page, request, `reflow_${Date.now()}`);
  await page.goto("/?q=Lantern");
  const results = page.getByRole("list", { name: "Search results" });
  await results
    .getByRole("button", { name: /Add The Lantern Keeper.*to wishlist/ })
    .click();
  await expect(results.getByText("Wishlisted", { exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const fontSize of [16, 32]) {
      const style = await page.addStyleTag({
        content: `html { font-size: ${fontSize}px; }`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      for (const region of [
        results,
        page.getByRole("region", { name: "Recently added", exact: true }),
        page.getByRole("region", { name: "Popular right now", exact: true }),
      ]) {
        for (const row of await region.getByRole("listitem").all()) {
          const link = await row.getByRole("link").boundingBox();
          expect(link).not.toBeNull();
          for (const button of await row.getByRole("button").all()) {
            const rect = await button.boundingBox();
            expect(rect).not.toBeNull();
            if (!rect || !link) continue;
            expect(rect.width).toBeGreaterThanOrEqual(44);
            expect(rect.height).toBeGreaterThanOrEqual(44);
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(width);
            expect(rect.y).toBeGreaterThanOrEqual(link.y + link.height);
          }
        }
      }
      await style.evaluate((node) => node.parentNode?.removeChild(node));
    }
  }
});

test("saving the expanded eighth search match preserves filters, expansion and position", async ({
  page,
  request,
}) => {
  await signUp(page, request, `expanded_${Date.now()}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?q=Search%20Journey&year=2020&platform=PC");
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("listitem")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Show 2 more matches", exact: true })
    .click();
  await expect(results.getByRole("listitem")).toHaveCount(8);
  const row = results.getByRole("listitem").last();
  const save = row.getByRole("button", {
    name: "Add Search Journey 8 to wishlist",
    exact: true,
  });
  await save.scrollIntoViewIfNeeded();
  await save.focus();
  const position = await page.evaluate(() => window.scrollY);
  const url = page.url();
  await save.click();
  await expect(row.getByText("Wishlisted", { exact: true })).toBeVisible();
  await expect(results.getByRole("listitem")).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: "Show fewer matches", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Release year", { exact: true })).toHaveValue(
    "2020",
  );
  await expect(page.getByLabel("Platform", { exact: true })).toHaveValue("PC");
  await expect(page).toHaveURL(url);
  expect(await page.evaluate(() => window.scrollY)).toBe(position);
});
