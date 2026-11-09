import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { chooseAccountMenuItem } from "./support/header";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";

test("Private owner preview, publication and withdrawal protect documents, metadata, images and independent Lists", async ({
  page,
  request,
  browser,
}) => {
  test.slow();
  const username = uniqueUsername("visibility");
  const email = await signUp(page, request, username);
  const other = await browser.newContext();
  const visitor = await browser.newContext();
  try {
    const second = await other.newPage();
    await signUp(second, request, uniqueUsername("viewer"));
    const path = `/u/${username}`;
    const listId = randomUUID();
    const privateListId = randomUUID();
    const secret = `PRIVATE_NOTE_${username}`;
    await seedSql(
      request,
      [
        `update "user" set feed_token = 'credential-' || username where email = $1`,
        `insert into game (id, slug, title, genres, platforms, synced_at) values (99101, 'visibility-game', 'Visibility game', '{}', '{PC}', now()) on conflict do nothing`,
        `insert into journal_entry (user_id, game_id, status, updated_at) select id, 99101, 'played', now() from "user" where email = $1`,
        `insert into playthrough (user_id, game_id, platform, started_on, hours, notes) select id, 99101, 'PC', '2026-01-01', 12, '${secret}' from "user" where email = $1`,
        `insert into custom_list (id, user_id, submission_id, title, visibility) select '${listId}', id, '${randomUUID()}', 'Independent Public List', 'public' from "user" where email = $1`,
        `insert into custom_list (id, user_id, submission_id, title, visibility) select '${privateListId}', id, '${randomUUID()}', 'Hidden List', 'private' from "user" where email = $1`,
      ],
      [email],
    );

    await chooseAccountMenuItem(page, "My profile");
    await expect(
      page.getByText("Only you can see this.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: username, exact: true }),
    ).toBeVisible();
    expect(await page.content()).not.toContain(secret);
    await expect(
      page.getByText("Private gaming journal", { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Profile unavailable · shelve.games");

    const guest = await visitor.newPage();
    const assertHidden = async () => {
      // Warm the owner-only response before probing the same URL as outsiders.
      const owner = await page.request.get(path);
      expect(owner.status()).toBe(200);
      expect(owner.headers()["cache-control"]).toContain("no-store");
      expect(await owner.text()).toContain("Only you can see this.");
      for (const context of [visitor, other]) {
        for (const suffix of ["", "?view=stats", "/opengraph-image"]) {
          const response = await context.request.get(`${path}${suffix}`);
          expect(response.status()).toBe(404);
          expect(response.headers()["cache-control"]).toContain("no-store");
          expect(await response.text()).not.toMatch(
            new RegExp(`${secret}|${email}|credential-|Visibility game`),
          );
        }
        const flight = await context.request.get(path, {
          headers: { RSC: "1" },
        });
        expect(flight.status()).toBe(404);
        expect(flight.headers()["cache-control"]).toContain("no-store");
        expect(await flight.text()).not.toMatch(
          new RegExp(`${secret}|${email}|credential-|Visibility game`),
        );
        expect(
          (await context.request.get(`${path}/lists/${listId}`)).status(),
        ).toBe(200);
        for (const suffix of ["", "/opengraph-image"]) {
          expect(
            (
              await context.request.get(
                `${path}/lists/${privateListId}${suffix}`,
              )
            ).status(),
          ).toBe(404);
        }
      }
      expect((await guest.goto(path))?.status()).toBe(404);
      await expect(
        guest.getByRole("heading", { name: "404", exact: true }),
      ).toBeVisible();
      await expect(guest).toHaveTitle("shelve.games");
      await expect(guest.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        "shelve.games",
      );
      await expect(
        guest.locator(`meta[content*="/u/${username}"]`),
      ).toHaveCount(0);
      const listResponse = await guest.goto(`${path}/lists/${listId}`);
      expect(listResponse?.status()).toBe(200);
      const listImage = await visitor.request.get(
        `${path}/lists/${listId}/opengraph-image`,
      );
      expect(listImage.status()).toBe(200);
      expect(listImage.headers()["cache-control"]).toContain("no-store");
      await expect(
        guest.getByRole("heading", { name: "Independent Public List" }),
      ).toBeVisible();
      await expect(
        guest.getByRole("link", { name: `@${username}` }),
      ).toHaveCount(0);
      expect(
        (await visitor.request.get(`${path}/lists/${privateListId}`)).status(),
      ).toBe(404);
    };
    await assertHidden();

    await page
      .getByRole("link", { name: "Change profile visibility in Settings" })
      .click();
    const form = page.getByRole("form", { name: "Profile visibility" });
    await expect(form.getByRole("radio", { name: /^Private/ })).toBeChecked();
    await expect(
      page.getByRole("link", { name: "Privacy notice", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download JSON/ }),
    ).toBeVisible();
    for (const visibility of ["Public", "Private"] as const) {
      await form
        .getByRole("radio", { name: new RegExp(`^${visibility}`) })
        .check();
      await form.getByRole("button", { name: "Save", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(form.getByRole("status")).toHaveText("Saved");
      await expect(
        form.getByRole("button", { name: "Save", exact: true }),
      ).toBeFocused();
      await page.reload();
      await expect(
        form.getByRole("radio", { name: new RegExp(`^${visibility}`) }),
      ).toBeChecked();
      if (visibility === "Private") {
        await assertHidden();
        continue;
      }
      for (const context of [visitor, other]) {
        const response = await context.request.get(path);
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toContain("no-store");
        const html = await response.text();
        expect(html).toContain("Visibility game");
        expect(html).not.toMatch(
          new RegExp(`${secret}|${email}|credential-${username}`),
        );
        const flight = await context.request.get(path, {
          headers: { RSC: "1" },
        });
        expect(flight.status()).toBe(200);
        expect(flight.headers()["cache-control"]).toContain("no-store");
        expect(await flight.text()).not.toMatch(
          new RegExp(`${secret}|${email}|credential-${username}`),
        );
        const image = await context.request.get(`${path}/opengraph-image`);
        expect(image.status()).toBe(200);
        expect(image.headers()["cache-control"]).toContain("no-store");
        expect(image.headers()["content-type"]).toContain("image/png");
      }
      await guest.goto(path);
      await expect(guest).toHaveTitle(`${username}’s journal · shelve.games`);
      await guest.goto(`${path}/lists/${listId}`);
      await expect(
        guest.getByRole("link", { name: `@${username}` }),
      ).toHaveAttribute("href", path);
    }
  } finally {
    await other.close();
    await visitor.close();
  }
});

test("Settings retains the visibility choice after a failed save and supports keyboard retry", async ({
  page,
  request,
}) => {
  await signUp(page, request, uniqueUsername("visibility_retry"));
  await page.goto("/settings");
  const form = page.getByRole("form", { name: "Profile visibility" });
  await form.getByRole("radio", { name: /^Public/ }).check();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/settings", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await held;
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText("Saving…");
  await expect(
    form.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  release();
  await expect(form.getByRole("alert")).toHaveText(
    "Could not save your profile visibility. Please try again.",
  );
  await expect(form.getByRole("radio", { name: /^Public/ })).toBeChecked();
  await page.unroute("**/settings");
  await form.getByRole("button", { name: "Retry", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(form.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(form.getByRole("radio", { name: /^Public/ })).toBeChecked();
});

test("visibility Settings and Private owner preview reflow in both themes with enlarged text and reduced motion", async ({
  page,
  request,
}, testInfo) => {
  const username = uniqueUsername("visibility_reflow");
  await signUp(page, request, username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    for (const path of ["/settings", `/u/${username}`]) {
      await page.goto(path);
      if (path === "/settings")
        await expect(
          page.getByRole("form", { name: "Profile visibility" }),
        ).toBeVisible();
      else
        await expect(
          page.getByText("Only you can see this.", { exact: false }),
        ).toBeVisible();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const fontSize of ["16px", "32px"]) {
          await page.evaluate(
            ({ theme, fontSize }) => {
              document.documentElement.classList.toggle(
                "dark",
                theme === "dark",
              );
              document.documentElement.classList.toggle(
                "light",
                theme === "light",
              );
              document.documentElement.style.fontSize = fontSize;
            },
            { theme, fontSize },
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${theme} ${path} ${width} ${fontSize}`,
          ).toBe(true);
          if (width === 320 && fontSize === "16px")
            await page.screenshot({
              path: testInfo.outputPath(
                `${theme}-${path === "/settings" ? "settings" : "owner"}.png`,
              ),
              fullPage: true,
            });
        }
      }
    }
  }
});
