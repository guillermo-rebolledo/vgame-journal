import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";
import { supportUrl } from "./support/url";

test("review gates owners, previews the exact PNG, retries and denies download after disablement @release-smoke", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/year-in-review");
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await page.request.get("/year-in-review/image")).status()).toBe(404);
  const username = uniqueUsername("recap");
  const email = await signUp(page, request, username);
  await page.goto("/stats");
  await expect(
    page.getByRole("link", { name: /Your year in the Journal/ }),
  ).toHaveCount(0);
  await page.goto("/year-in-review");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await request.post(supportUrl("/review-fixture"), {
    data: { username, enabled: true, now: "2026-11-30T23:59:59Z" },
  });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Your year in the Journal/ }),
  ).toHaveCount(1);
  await page.goto("/stats");
  await page.getByRole("link", { name: /Your year in the Journal/ }).click();
  await expect(
    page.getByRole("heading", { name: "A year still waiting to be recorded" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview PNG" })).toHaveCount(
    0,
  );
  await seedSql(
    request,
    [
      `insert into game (id,title,slug,genres,platforms,synced_at) values (915800,'A very long missing cover game 日本語','year-review-fixture','{}','{PC}',now()) on conflict (id) do nothing`,
      `update game set cover_image_id = 'review_broken' where id = 915800`,
      `insert into journal_entry (user_id,game_id,status,created_at,updated_at) select id,915800,'wishlist','2026-06-01',now() from "user" where email=$1`,
      `insert into playthrough (user_id,game_id,platform,started_on,notes) select id,915800,'PC','2026-02-01','PRIVATE_RECAP_NOTE' from "user" where email=$1`,
    ],
    [email],
  );
  await request.post(supportUrl("/review-fixture"), {
    data: { username, enabled: true, now: "2026-12-01T00:00:00Z" },
  });
  await page.goto("/");
  await page.getByRole("link", { name: /Your year in the Journal/ }).click();
  await expect(
    page.getByRole("heading", { name: "1 game played" }),
  ).toBeVisible();
  await expect(page.getByText("2026-12-01", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Include username/ }),
  ).not.toBeChecked();
  await expect(page.getByText("PRIVATE_RECAP_NOTE")).toHaveCount(0);
  expect(await page.content()).not.toContain(email);
  let fail = true;
  await page.route("**/year-in-review/image?*", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503 });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Preview PNG" }).click();
  await page.getByRole("button", { name: "Retry image" }).click();
  const preview = page.getByRole("img", { name: /PNG preview/ });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("alt", /without your username/);
  const expected = await preview.evaluate(async (img: HTMLImageElement) =>
    Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
  );
  // Check the ruled poster's actual pixels so reverting to the old export fails.
  expect(
    await preview.evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(img, 0, 0);
      return [
        [20, 20],
        [20, 400],
        [850, 30],
        [543, 900],
      ].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    }),
  ).toEqual([
    [247, 245, 236, 255], // Keepsake Paper
    [22, 22, 22, 255], // Ink hero
    [242, 239, 111, 255], // Marker logo cell
    [22, 22, 22, 255], // Vertical rule
  ]);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain("2026.png");
  const path = await download.path();
  if (!path) throw new Error("Download missing");
  const bytes = await readFile(path);
  expect(Array.from(bytes)).toEqual(expected);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1350);
  await testInfo.attach("year-in-review.png", {
    body: bytes,
    contentType: "image/png",
  });
  await page.getByRole("checkbox", { name: /Include username/ }).check();
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "Preview PNG" }).click();
  await expect(
    page.getByRole("img", {
      name: `PNG preview of your 2026 Journal review for @${username}`,
    }),
  ).toBeVisible();
  await request.post(supportUrl("/review-fixture"), {
    data: { username, enabled: false, now: "2027-01-01T00:00:00Z" },
  });
  await page.getByRole("button", { name: "Download PNG" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Download unavailable" }),
  ).toBeVisible();
  expect(
    (await page.request.get("/year-in-review/image?username=1")).status(),
  ).toBe(404);
  await page.goto("/year-in-review");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await page.goto("/stats");
  await expect(
    page.getByRole("link", { name: /Your year in the Journal/ }),
  ).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  test(`review reflows, supports keyboard and reduced motion in ${theme}`, async ({
    page,
    request,
  }) => {
    const username = uniqueUsername("recap_a11y");
    const email = await signUp(page, request, username);
    await seedSql(
      request,
      [
        `insert into game (id,title,slug,genres,platforms,synced_at) values (915899,'An exceptionally long game title with 日本語 for narrow screens','review-accessibility-fixture','{}','{PC}',now()) on conflict (id) do nothing`,
        `insert into journal_entry (user_id,game_id,status,created_at,updated_at) select id,915899,'backlog','2026-01-01',now() from "user" where email=$1`,
      ],
      [email],
    );
    await request.post(supportUrl("/review-fixture"), {
      data: { username, enabled: true, now: "2026-12-15T12:00:00Z" },
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/year-in-review");
    await page.evaluate((theme) => {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(theme);
    }, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    expect(
      await page
        .locator(".review-tile")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    const back = page.getByRole("link", { name: "Back to Stats" });
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/stats$/);
    await page.goto("/year-in-review");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}

test("PNG stays bounded for one through twelve covers, including a full-year played-only review", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const username = uniqueUsername("recap_sizes");
  const email = await signUp(page, request, username);
  await request.post(supportUrl("/review-fixture"), {
    data: { username, enabled: true, now: "2027-01-02T12:00:00Z" },
  });
  await seedSql(
    request,
    [
      `insert into game (id,title,slug,genres,platforms,synced_at) select 915800+i,'A long title without cover art ' || i,'review-size-' || i,'{}','{PC}',now() from generate_series(1,12) i on conflict (id) do nothing`,
    ],
    [],
  );
  for (let n = 1; n <= 12; n++) {
    await seedSql(
      request,
      [
        `insert into journal_entry (user_id,game_id,status,created_at,updated_at) select id,915800+$2,'backlog','2025-01-01',now() from "user" where email=$1`,
        `insert into playthrough (user_id,game_id,platform,started_on) select id,915800+$2,'PC','2026-02-01' from "user" where email=$1`,
      ],
      [email, String(n)],
    );
    const response = await page.request.get(
      "/year-in-review/image?asOf=2026-12-31T23%3A59%3A59.999Z",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect(response.headers()["cache-control"]).toContain("no-store");
    const bytes = await response.body();
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
      1080, 1350,
    ]);
    if ([1, 2, 3, 4, 12].includes(n))
      await testInfo.attach(`review-${n}-covers.png`, {
        body: bytes,
        contentType: "image/png",
      });
  }
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Your year in the Journal/ }),
  ).toHaveCount(1);
  await page.goto("/year-in-review");
  await expect(
    page.getByRole("heading", { name: "2026", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "12 games played" }),
  ).toBeVisible();
});

test("Home invitation tracks real visits and persists session and year choices independently", async ({
  page,
  request,
  browser,
}) => {
  const username = uniqueUsername("recap_banner");
  const email = await signUp(page, request, username);
  await request.post(supportUrl("/review-fixture"), {
    data: { username, enabled: true, now: "2026-11-15T12:00:00Z" },
  });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Your 2026 in the Journal" });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
  // Server rendering/prefetching the destination is not a real visit.
  expect((await page.request.get("/year-in-review")).status()).toBe(200);
  await page.reload();
  await expect(banner.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
  const viewed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/year-in-review",
  );
  await banner.getByRole("link", { name: /View/ }).click();
  await viewed;
  await page.goto("/");
  await expect(banner.getByRole("button", { name: "Dismiss" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your Journal", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(banner).toHaveCount(0);
  const tab = await page.context().newPage();
  await tab.goto("/");
  await expect(
    tab.getByRole("region", { name: "Your 2026 in the Journal" }),
  ).toHaveCount(0);
  await tab.close();

  const origin = new URL(page.url()).origin;
  const other = await browser.newContext({ baseURL: origin });
  try {
    expect(
      (
        await other.request.post("/api/auth/sign-in/email", {
          headers: { origin },
          data: { email, password: "password123" },
        })
      ).ok(),
    ).toBe(true);
    const otherPage = await other.newPage();
    await otherPage.goto("/");
    const otherBanner = otherPage.getByRole("region", {
      name: "Your 2026 in the Journal",
    });
    await expect(
      otherBanner.getByRole("button", { name: "Dismiss" }),
    ).toBeVisible();
    await otherBanner.getByRole("button", { name: "Don’t show again" }).click();
    await expect(otherBanner).toHaveCount(0);
    await otherPage.reload();
    await expect(otherBanner).toHaveCount(0);
  } finally {
    await other.close();
  }

  // A fresh sign-in has no session dismissal, but still respects the account preference.
  await page.request.post("/api/auth/sign-out", { headers: { origin } });
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password: "password123" },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.goto("/stats");
  await expect(
    page.getByRole("link", { name: /Your year in the Journal/ }),
  ).toBeVisible();
});
