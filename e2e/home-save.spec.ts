import { expect, test } from "@playwright/test";
import { closeCatalog } from "./support/catalog";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { signUp, uniqueUsername } from "./support/sign-up";
import { supportUrl } from "./support/url";

const updates = (page: import("@playwright/test").Page) =>
  page.getByRole("status", { name: "Journal updates", exact: true });
const count = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("link", { name, exact: true, includeHidden: true });

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
  // A previously issued shelf-save continuation must remain valid after the search redesign.
  await page.goto(
    "/?q=Celeste&year=2018&platform=PC&all=1&filters=1&saveGame=1&saveSlug=celeste&saveStatus=wishlist",
  );
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
  await expect(
    page.getByRole("combobox", { name: "Release year", exact: true }),
  ).toContainText("2018");
  await expect(
    page.getByRole("combobox", { name: "Platform", exact: true }),
  ).toContainText("PC");
  await closeCatalog(page);
  await count(page, "Wishlist (1)").click();
  await expect(page.getByRole("link", { name: /Celeste/ })).toBeVisible();
});

test("signup and onboarding preserve Backlog intent; cancellation and repeated or invalid return visits never write", async ({
  page,
  request,
}) => {
  await page.goto(
    "/?q=Celeste&platform=PC&all=1&saveGame=1&saveSlug=celeste&saveStatus=backlog",
  );
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
  const add = page
    .getByRole("region", { name: "Recently released", exact: true })
    .getByRole("button", {
      name: "Add to backlog for Discovery One",
      exact: true,
    });
  await add.focus();
  await page.keyboard.press("Space");
  await expect(count(page, "Backlog (1)")).toBeVisible();
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

test("shelf saves coordinate duplicate games and pending controls without search actions", async ({
  page,
  request,
}) => {
  await request.get("/api/cron/refresh-release-dates", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  await signUp(page, request, uniqueUsername("shelf_pending"));
  const recent = page.getByRole("region", {
    name: "Recently released",
    exact: true,
  });
  const popular = page.getByRole("region", {
    name: "Recently trending",
    exact: true,
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route("**/*", async (route) => {
    if (!held && route.request().headers()["next-action"]) {
      held = true;
      await gate;
    }
    await route.continue();
  });
  try {
    await recent
      .getByRole("button", {
        name: "Add to backlog for Discovery One",
        exact: true,
      })
      .click();
    await expect(
      popular.getByRole("button", {
        name: "Add to wishlist for Discovery One",
        exact: true,
      }),
    ).toHaveAttribute("aria-disabled", "true");
    release();
    await expect(count(page, "Backlog (1)")).toBeVisible();
    await expect(
      recent.getByRole("button", {
        name: /Change status for Discovery One$/,
      }),
    ).toBeVisible();
    await expect(
      popular.getByRole("button", {
        name: /Change status for Discovery One$/,
      }),
    ).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
  await popular
    .getByRole("button", {
      name: /Change status for Discovery One$/,
    })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Wishlist", exact: true })
    .click();
  await expect(count(page, "Backlog (0)")).toBeVisible();
  await expect(count(page, "Wishlist (1)")).toBeVisible();
  await page.reload();
  await expect(count(page, "Wishlist (1)")).toBeVisible();
});
