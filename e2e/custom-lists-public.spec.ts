import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { signUp, uniqueUsername } from "./support/sign-up";
import { supportUrl } from "./support/url";

async function query(
  request: APIRequestContext,
  sql: string,
  params: unknown[] = [],
) {
  const response = await request.post(supportUrl("/query"), {
    data: { sql, params },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function seedList(
  request: APIRequestContext,
  email: string,
  options: { title?: string; visibility?: string; games?: number } = {},
) {
  const id = randomUUID();
  await query(
    request,
    `insert into custom_list (id, user_id, submission_id, title, description, visibility) select $1, id, $2, $3, $4, $5 from "user" where email = $6`,
    [
      id,
      randomUUID(),
      options.title ?? "Weekend discoveries",
      "First line\n<em>Plain text</em>",
      options.visibility ?? "public",
      email,
    ],
  );
  await query(
    request,
    `insert into game (id, slug, title, genres, platforms, synced_at) select n, 'public-list-game-' || n, 'Public list game ' || n, '{}', '{PC}', now() from generate_series(87001, 87000 + $1::int) n on conflict do nothing`,
    [options.games ?? 2],
  );
  await query(
    request,
    `insert into list_entry (list_id, game_id, position) select $1, n, 87000 + $2::int - n from generate_series(87001, 87000 + $2::int) n`,
    [id, options.games ?? 2],
  );
  return id;
}

test("signed-out readers get the ordered public list, canonical sharing metadata and generic site image", async ({
  page,
  request,
  browser,
}) => {
  const username = `listpub_${Date.now()}`;
  const email = await signUp(page, request, username);
  const id = await seedList(request, email);
  const path = `/u/${username}/lists/${id}`;
  const visitor = await browser.newContext();
  try {
    const guest = await visitor.newPage();
    const response = await guest.goto(path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(
      guest.getByRole("heading", { level: 1, name: "Weekend discoveries" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("main").getByText("First line <em>Plain text</em>"),
    ).toBeVisible();
    await expect(
      guest.getByRole("link", { name: `@${username}` }),
    ).toHaveAttribute("href", `/u/${username}`);
    const games = guest
      .getByRole("list", { name: "List games" })
      .getByRole("link");
    await expect(games).toHaveText([
      "Public list game 87002",
      "Public list game 87001",
    ]);
    await expect(games.first()).toHaveAttribute(
      "href",
      "/games/public-list-game-87002",
    );
    await expect(guest.getByLabel("Public list URL")).toHaveValue(
      `https://shelve.games${path}`,
    );
    await expect(guest.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://shelve.games${path}`,
    );
    await expect(guest).toHaveTitle(
      `Weekend discoveries by ${username} · shelve.games`,
    );
    const image = await guest
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(image).toContain(`${path}/opengraph-image`);
    if (!image) throw new Error("Missing share image");
    const imageResponse = await request.get(
      image.replace("https://shelve.games", new URL(guest.url()).origin),
    );
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()["cache-control"]).toContain("no-store");
    expect(imageResponse.headers()["content-type"]).toContain("image/png");
    const generic = await request.get("/opengraph-image");
    expect(await imageResponse.body()).toEqual(await generic.body());
    await expect(
      guest.getByRole("button", { name: /edit|delete|remove|move/i }),
    ).toHaveCount(0);
    expect(await guest.content()).not.toContain(email);
    const flight = await visitor.request.get(path, { headers: { RSC: "1" } });
    expect(flight.headers()["content-type"]).toContain("text/x-component");
    expect(flight.headers()["cache-control"]).toContain("no-store");
    expect(await flight.text()).toContain("Weekend discoveries");
    await query(
      request,
      "update custom_list set title = 'Renamed collection', description = $1 where id = $2",
      ["A".repeat(2000), id],
    );
    await guest.goto(`/u/${username.toUpperCase()}/lists/${id}`);
    await expect(guest).toHaveTitle(
      `Renamed collection by ${username} · shelve.games`,
    );
    await expect(guest.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://shelve.games${path}`,
    );
    await expect(guest.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "A".repeat(200),
    );
    const bot = await visitor.request.get(path, {
      headers: { "User-Agent": "Twitterbot" },
    });
    expect(await bot.text()).toContain("Renamed collection");
  } finally {
    await visitor.close();
  }
});

test("private, wrong-creator, malformed and revoked public URLs are generic real 404s for every reader", async ({
  page,
  request,
  browser,
}) => {
  const username = `listprivacy_${Date.now()}`;
  const email = await signUp(page, request, username);
  const id = await seedList(request, email, { title: "REVOKED_LIST_TITLE_87" });
  const hiddenId = await seedList(request, email, {
    title: "HIDDEN_LIST_TITLE_87",
    visibility: "private",
    games: 0,
  });
  await query(
    request,
    "update custom_list set description = 'REVOKED_DESCRIPTION_87' where id = $1",
    [id],
  );
  const path = `/u/${username}/lists/${id}`;
  const visitor = await browser.newContext();
  const unrelated = await browser.newContext();
  try {
    const other = await unrelated.newPage();
    const otherUsername = `listother_${Date.now()}`;
    await signUp(other, request, otherUsername);
    const guest = await visitor.newPage();
    await guest.goto(path);
    await expect(
      guest.getByRole("heading", { name: "REVOKED_LIST_TITLE_87" }),
    ).toBeVisible();
    const previousImage = await guest
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    await query(
      request,
      "update custom_list set visibility = 'private', revision = revision + 1 where id = $1",
      [id],
    );
    for (const client of [visitor.request, unrelated.request, page.request]) {
      for (const target of [
        path,
        `/u/${username}/lists/${hiddenId}`,
        `/u/${otherUsername}/lists/${id}`,
        `/u/${username}/lists/not-a-uuid`,
        `/u/${username}/lists/${randomUUID()}`,
      ]) {
        for (const headers of [{}, { RSC: "1" }] as Record<string, string>[]) {
          const response = await client.get(target, { headers });
          expect(response.status(), target).toBe(404);
          expect(response.headers()["cache-control"]).toContain("no-store");
          const body = await response.text();
          for (const secret of [
            "REVOKED_LIST_TITLE_87",
            "REVOKED_DESCRIPTION_87",
            "HIDDEN_LIST_TITLE_87",
            "Public list game 87002",
          ])
            expect(body).not.toContain(secret);
          expect(body).toContain("noindex");
        }
      }
    }
    if (!previousImage) throw new Error("Missing share image");
    const image = await visitor.request.get(
      previousImage.replace(
        "https://shelve.games",
        new URL(guest.url()).origin,
      ),
    );
    expect(image.headers()["cache-control"]).toContain("no-store");
    expect(await image.text()).not.toContain("REVOKED_LIST_TITLE_87");
    for (const target of [
      "/lists",
      "/lists/malformed.with.dot",
      `/u/${username}`,
      `/u/${username}?view=lists`,
    ]) {
      const response = await visitor.request.get(target, { maxRedirects: 0 });
      expect(response.headers()["cache-control"], target).toContain("no-store");
    }
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /lists");
    await query(
      request,
      "update custom_list set visibility = 'public' where id = $1",
      [id],
    );
    const restored = await visitor.request.get(path);
    expect(restored.status()).toBe(200);
    expect(await restored.text()).toContain("REVOKED_LIST_TITLE_87");
    await query(request, "delete from custom_list where id = $1", [id]);
    expect((await visitor.request.get(path)).status()).toBe(404);
  } finally {
    await visitor.close();
    await unrelated.close();
  }
});

test("profile Lists discovers only public cards and counts while preserving URL state and pagination", async ({
  page,
  request,
  browser,
}) => {
  const username = `listprofile_${Date.now()}`;
  const email = await signUp(page, request, username);
  const id = await seedList(request, email, {
    title: "Discover this collection",
    games: 50,
  });
  await seedList(request, email, {
    title: "Empty public collection",
    games: 0,
  });
  await seedList(request, email, {
    title: "PROFILE_SECRET_LIST_87",
    visibility: "private",
    games: 0,
  });
  await query(
    request,
    `insert into custom_list (id, user_id, submission_id, title, visibility) select gen_random_uuid(), id, gen_random_uuid(), 'More public ' || n, 'public' from "user", generate_series(1, 48) n where email = $1`,
    [email],
  );
  await query(
    request,
    "update custom_list set updated_at = now() + interval '1 day' where id = $1",
    [id],
  );
  const visitor = await browser.newContext();
  try {
    const guest = await visitor.newPage();
    await guest.goto(
      `/u/${username}?view=wishlist&wishlistPage=2&keep=1#saved`,
    );
    await guest.getByRole("button", { name: "Lists", exact: true }).click();
    await expect(guest).toHaveURL(/view=lists/);
    expect(new URL(guest.url()).searchParams.get("keep")).toBe("1");
    expect(new URL(guest.url()).searchParams.get("wishlistPage")).toBe("2");
    expect(new URL(guest.url()).hash).toBe("#saved");
    await expect(
      guest.getByText("50 public lists", { exact: true }),
    ).toBeVisible();
    const cards = guest
      .getByRole("list", { name: "Public lists" })
      .getByRole("listitem");
    await expect(cards).toHaveCount(48);
    await expect(
      guest.getByRole("link", { name: /Discover this collection/ }),
    ).toHaveAttribute("href", `/u/${username}/lists/${id}`);
    await expect(guest.getByText(/^50 games · Updated/)).toBeVisible();
    await guest
      .getByRole("navigation", { name: "Public lists pages" })
      .getByRole("button", { name: "Next" })
      .click();
    await expect(cards).toHaveCount(2);
    expect(new URL(guest.url()).searchParams.get("publicListPage")).toBe("2");
    await guest.goBack();
    await expect(cards).toHaveCount(48);
    await guest.goForward();
    await guest.reload();
    await expect(cards).toHaveCount(2);
    for (const headers of [{}, { RSC: "1" }] as Record<string, string>[]) {
      const response = await visitor.request.get(`/u/${username}?view=lists`, {
        headers,
      });
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(await response.text()).not.toContain("PROFILE_SECRET_LIST_87");
    }
    await guest.goto(`/u/${username}/lists/${id}?keep=1`);
    const games = guest
      .getByRole("list", { name: "List games" })
      .getByRole("listitem");
    await expect(games).toHaveCount(48);
    await guest.getByRole("button", { name: "Next", exact: true }).click();
    await expect(games).toHaveCount(2);
    expect(new URL(guest.url()).searchParams.get("listGamePage")).toBe("2");
    await expect(
      guest.getByRole("link", { name: "Public list game 87002", exact: true }),
    ).toBeVisible();
    await guest.reload();
    await expect(games).toHaveCount(2);
    await query(
      request,
      "update custom_list set visibility = 'private' where user_id = (select id from \"user\" where email = $1)",
      [email],
    );
    await guest.goto(`/u/${username}?view=lists&publicListPage=99&keep=1`);
    await expect(
      guest
        .getByRole("main")
        .getByText("No public lists yet.", { exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("main").getByText("0 public lists", { exact: true }),
    ).toBeVisible();
    await expect(guest).not.toHaveURL(/publicListPage=/);
    expect(new URL(guest.url()).searchParams.get("keep")).toBe("1");
    expect(await guest.content()).not.toContain("Discover this collection");
    expect(await guest.content()).not.toContain("PROFILE_SECRET_LIST_87");
  } finally {
    await visitor.close();
  }
});

async function listState(
  request: APIRequestContext,
  username: string,
  state: {
    fail?: boolean;
    milliseconds?: number;
    hold?: boolean;
    revokeId?: string;
  },
) {
  const response = await request.post(supportUrl("/public-lists-state"), {
    data: { username, ...state },
  });
  expect(response.ok()).toBeTruthy();
}

test("public readers see loading, unavailable with recovery, and genuine empty content", async ({
  page,
  request,
  browser,
}) => {
  const username = uniqueUsername("listrecover");
  const email = await signUp(page, request, username);
  const id = await seedList(request, email, {
    title: "An empty collection",
    games: 0,
  });
  const path = `/u/${username}/lists/${id}`;
  const visitor = await browser.newContext();
  try {
    const guest = await visitor.newPage();
    await listState(request, username, { hold: true });
    await guest.goto(`/u/${username}?view=lists`, { waitUntil: "commit" });
    await expect(
      guest.getByRole("status").filter({ hasText: "Loading profile…" }),
    ).toBeVisible();
    await listState(request, username, {});
    await expect(
      guest.getByRole("link", { name: /An empty collection/ }),
    ).toBeVisible();
    await listState(request, username, { fail: true });
    await guest.reload();
    await expect(guest.getByRole("main").getByRole("alert")).toHaveText(
      "Lists are unavailable. Please try again.",
    );
    await expect(
      guest
        .getByRole("main")
        .getByText("No public lists yet.", { exact: true }),
    ).toHaveCount(0);
    await listState(request, username, {});
    await guest
      .getByRole("button", { name: "Retry lists", exact: true })
      .click();
    await expect(
      guest.getByRole("link", { name: /An empty collection/ }),
    ).toBeVisible();
    await listState(request, username, { fail: true });
    const failed = await guest.goto(`${path}?keep=recovery&listGamePage=2`);
    expect(failed?.headers()["cache-control"]).toContain("no-store");
    await expect(guest.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(guest.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(guest.locator('link[rel="canonical"]')).toHaveCount(0);
    expect(await guest.content()).not.toContain("An empty collection");
    await listState(request, username, {});
    await guest
      .getByRole("button", { name: "Retry lists", exact: true })
      .click();
    await expect(
      guest
        .getByRole("main")
        .getByText("No games in this list yet.", { exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "An empty collection" }),
    ).toBeVisible();
    expect(new URL(guest.url()).searchParams.get("keep")).toBe("recovery");
    await expect(
      guest.locator('meta[name="robots"][content*="noindex"]'),
    ).toHaveCount(0);
    await expect(guest.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      "index, follow",
    );
    await expect
      .poll(() =>
        guest
          .locator('link[rel="canonical"]')
          .evaluateAll((links) => [
            ...new Set(links.map((link) => link.getAttribute("href"))),
          ]),
      )
      .toEqual([`https://shelve.games${path}`]);
  } finally {
    await listState(request, username, {});
    await visitor.close();
  }
});

test("page and metadata reauthorize when visibility changes after a successful proxy read", async ({
  page,
  request,
  browser,
}) => {
  const username = `listrace_${Date.now()}`;
  const email = await signUp(page, request, username);
  const id = await seedList(request, email, {
    title: "PREFLIGHT_MUST_NOT_AUTHORIZE_87",
  });
  const visitor = await browser.newContext();
  try {
    await listState(request, username, { revokeId: id });
    const response = await visitor.request.get(`/u/${username}/lists/${id}`);
    const body = await response.text();
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(body).not.toContain("PREFLIGHT_MUST_NOT_AUTHORIZE_87");
    expect(body).not.toContain("Public list game 87002");
    expect(body).toContain("noindex");
    expect(
      (await visitor.request.get(`/u/${username}/lists/${id}`)).status(),
    ).toBe(404);
  } finally {
    await listState(request, username, {});
    await visitor.close();
  }
});

for (const theme of ["light", "dark"]) {
  test(`public lists handle phone ${theme} layout, long text, missing artwork and keyboard navigation`, async ({
    page,
    request,
    browser,
  }) => {
    const username = `listphone_${Date.now()}`;
    const email = await signUp(page, request, username);
    const title = "L".repeat(100);
    await seedList(request, email, { title });
    await query(
      request,
      "update game set cover_image_id = 'list-artwork-unavailable-87' where id = 87001",
    );
    const visitor = await browser.newContext({
      viewport: { width: 320, height: 700 },
      reducedMotion: "reduce",
    });
    try {
      await visitor.addInitScript(
        (theme) => localStorage.setItem("theme", theme),
        theme,
      );
      const guest = await visitor.newPage();
      await guest.route("**/*list-artwork-unavailable-87*", (route) =>
        route.abort(),
      );
      await guest.goto(`/u/${username}?view=lists`);
      await expect(guest.locator("html")).toHaveClass(new RegExp(theme));
      await expect(guest.getByRole("heading", { name: title })).toBeVisible();
      expect(
        await guest.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await guest.getByRole("link", { name: new RegExp(title) }).click();
      await expect(
        guest.getByRole("heading", { name: title, level: 1 }),
      ).toBeVisible();
      expect(
        await guest.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        guest.locator('img[src*="list-artwork-unavailable-87"]'),
      ).toHaveCount(0);
      const url = guest.getByLabel("Public list URL");
      await url.focus();
      expect(
        await url.evaluate(
          (element: HTMLInputElement) =>
            (element.selectionEnd ?? 0) - (element.selectionStart ?? 0),
        ),
      ).toBeGreaterThan(50);
      await guest.keyboard.press("Tab");
      await expect(
        guest.getByRole("link", {
          name: "Public list game 87002",
          exact: true,
        }),
      ).toBeFocused();
      await guest.keyboard.press("Enter");
      await expect(guest).toHaveURL(/\/games\/public-list-game-87002$/);
    } finally {
      await query(
        request,
        "update game set cover_image_id = null where id = 87001",
      );
      await visitor.close();
    }
  });
}
