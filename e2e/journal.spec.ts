import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";

test("F05/F16: Release region save stays local on transport failure and retries the retained choice", async ({
  page,
  request,
}) => {
  await signUp(page, request, `region_${Date.now()}`);
  await page.goto("/settings");
  const japan = page.getByRole("radio", {
    name: "Japan Japanese release dates",
  });
  await expect(
    page.getByRole("radio", { name: /Earliest worldwide/ }),
  ).toBeChecked();
  await japan.check();

  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  await page.route("**/settings", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submissions++;
    await route.fetch();
    await held;
    await route.abort();
  });
  try {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saving…");
    await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
    for (const radio of await page.getByRole("radio").all())
      await expect(radio).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(submissions).toBe(1);
  } finally {
    release();
  }
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not save your release region",
  );
  await expect(japan).toBeChecked();
  await expect(japan).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Copy", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Download JSON" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Type DELETE to confirm")).toBeEnabled();
  await expect(page.getByRole("status")).not.toHaveText("Saved");
  await page.unroute("**/settings");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.getByRole("radio", { name: /Europe European/ }).check();
  await expect(page.getByRole("status")).toBeEmpty();
  await page.reload();
  await expect(japan).toBeChecked();
});

test("F05/F16: invalid region and expired-session action failures stay in Settings", async ({
  page,
  request,
}) => {
  await signUp(page, request, `region_action_${Date.now()}`);
  await page.goto("/settings");
  const japan = page.getByRole("radio", {
    name: "Japan Japanese release dates",
  });
  await japan.check();
  // Form fields are untrusted; the server must reject an unknown region.
  await japan.evaluate((input: HTMLInputElement) => {
    input.value = "mars";
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not save your release region",
  );
  await expect(japan).toBeChecked();
  await expect(page.getByRole("status")).not.toHaveText("Saved");
  await japan.evaluate((input: HTMLInputElement) => {
    input.value = "japan";
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(japan).toBeChecked();

  const signedOut = await page.request.post("/api/auth/sign-out", {
    data: {},
    headers: { origin: "http://localhost:3100" },
  });
  expect(signedOut.ok()).toBe(true);
  await page.getByRole("radio", { name: /Europe European/ }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not save your release region",
  );
  await expect(
    page.getByRole("radio", { name: /Europe European/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("status")).not.toHaveText("Saved");
  await expect(
    page.getByRole("heading", { name: "Calendar feed" }),
  ).toBeVisible();
});

test("F06: Calendar feed copy acknowledges success and recovers from denied or unavailable clipboard access", async ({
  page,
  request,
  context,
}) => {
  await signUp(page, request, `clipboard_${Date.now()}`);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/settings");
  const feed = page.getByRole("textbox", { name: "Calendar feed URL" });
  const url = await feed.inputValue();
  let pageErrors = 0;
  page.on("pageerror", () => {
    pageErrors++;
  });
  const copy = page.getByRole("button", { name: "Copy", exact: true });
  await copy.click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async (url) => (await navigator.clipboard.readText()) === url,
      url,
    ),
  ).toBe(true);
  await expect(copy).toBeVisible();

  for (const failure of [
    "denied",
    "rejected",
    "unavailable",
    "no-selection",
  ] as const) {
    await page.evaluate((failure) => {
      if (failure === "unavailable") {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: undefined,
        });
      } else {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              if (failure === "denied")
                throw new DOMException("Permission denied", "NotAllowedError");
              throw new Error("Clipboard unavailable");
            },
          },
        });
      }
      if (failure === "no-selection") {
        HTMLInputElement.prototype.select = () => {
          throw new Error("Selection unavailable");
        };
      }
    }, failure);
    await copy.click();
    const error = page.getByRole("main").getByRole("alert");
    await expect(error).toContainText("copy it manually");
    expect((await error.textContent())?.includes(url)).toBe(false);
    expect((await feed.inputValue()) === url).toBe(true);
    await expect(feed).toHaveAttribute("readonly", "");
    await expect(feed).toBeFocused();
    if (failure === "no-selection") await feed.press("ControlOrMeta+a");
    expect(
      await feed.evaluate(
        (input: HTMLInputElement) =>
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Copied", exact: true }),
    ).toHaveCount(0);
  }
  await page.evaluate(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });
  await copy.click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toBe(0);

  await page.setViewportSize({ width: 320, height: 740 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.style.fontSize = "32px";
      document.documentElement.classList.toggle("dark", theme === "dark");
    }, theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const control of [
      feed,
      copy,
      page.getByRole("button", { name: "Regenerate URL", exact: true }),
      page.getByRole("button", { name: "Download JSON" }),
    ]) {
      await control.scrollIntoViewIfNeeded();
      const bounds = await control.boundingBox();
      expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320).toBe(
        true,
      );
    }
  }
  await page.reload();
  expect((await feed.inputValue()) === url).toBe(true);
  const subscribe = page.getByRole("button", {
    name: "Subscribe",
    exact: true,
  });
  expect(
    (await subscribe.getAttribute("href")) ===
      url.replace(/^https?:/, "webcal:"),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Regenerate URL", exact: true })
    .click();
  await expect.poll(async () => (await feed.inputValue()) !== url).toBe(true);
  expect((await page.request.get(url)).status()).toBe(404);
  expect((await page.request.get(await feed.inputValue())).status()).toBe(200);
});

test("sign up, share a profile without notes, export the journal, and delete the account", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const username = `player_${Date.now()}`;
  const privateNote = "PRIVATE_NOTE_only_the_owner_should_see_this";
  const email = await signUp(page, request, username);

  await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
  await page.getByRole("link", { name: /Celeste/ }).click();
  await chooseStatus(page, "wishlist");
  await page.getByRole("link", { name: /^wishlist$/i }).click();
  await expect(
    page
      .getByRole("region", { name: /^Out now/ })
      .getByRole("link", { name: /Celeste/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Celeste/ }).click();
  await chooseStatus(page, "played");
  await chooseStatus(page, "completed");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page
    .getByLabel("Finished (optional)", { exact: true })
    .fill("2026-01-10");
  await page.getByLabel("Hours (optional)", { exact: true }).fill("12");
  await page
    .getByLabel("Notes (private, optional)", { exact: true })
    .fill(privateNote);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: privateNote }),
  ).toBeVisible();

  // Keep a second game on the wishlist to exercise its public read-only state.
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search games" }).fill("Silksong");
  await page.getByRole("link", { name: /Silksong/ }).click();
  await chooseStatus(page, "wishlist");

  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  const publicResponses: Promise<string>[] = [];
  publicPage.on("response", (response) => {
    if (response.url().includes(`/u/${username}`))
      publicResponses.push(response.text());
  });
  await publicPage.goto(`/u/${username}`);
  await expect(
    publicPage.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("heading", { name: username, exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("link", {
      name: "Celeste Played · Completed 2018 · PC",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("heading", { name: "Playthroughs", exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("main").getByText("2026-01-10", { exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("paragraph").filter({ hasText: /^PC$/ }),
  ).toBeVisible();
  await expect(publicPage.locator("form, textarea")).toHaveCount(0);
  await expect(publicPage.getByRole("main").getByText(privateNote)).toHaveCount(
    0,
  );
  expect((await Promise.all(publicResponses)).join("\n")).not.toContain(
    privateNote,
  );
  const libraryScreenshot = testInfo.outputPath("public-library.png");
  await publicPage.screenshot({ path: libraryScreenshot, fullPage: true });
  await testInfo.attach("Public library", {
    path: libraryScreenshot,
    contentType: "image/png",
  });

  await publicPage.getByRole("button", { name: /^wishlist$/i }).click();
  await expect(
    publicPage.getByRole("heading", { name: "Silksong", exact: true }),
  ).toBeVisible();
  await expect(publicPage.getByRole("button", { name: /^Move / })).toHaveCount(
    0,
  );
  await publicPage.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(
    publicPage.getByRole("main").getByText("12 hours", { exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("main").getByText("1 games", { exact: true }),
  ).toBeVisible();
  const statsScreenshot = testInfo.outputPath("public-stats.png");
  await publicPage.screenshot({ path: statsScreenshot, fullPage: true });
  await testInfo.attach("Public stats", {
    path: statsScreenshot,
    contentType: "image/png",
  });
  await publicPage.setViewportSize({ width: 390, height: 844 });
  await publicPage
    .getByRole("button", { name: "Library", exact: true })
    .click();
  const mobileScreenshot = testInfo.outputPath("public-mobile.png");
  await publicPage.screenshot({ path: mobileScreenshot, fullPage: true });
  await testInfo.attach("Public profile on mobile", {
    path: mobileScreenshot,
    contentType: "image/png",
  });

  const encoded = await publicPage.goto(`/u/%70${username.slice(1)}`);
  expect(encoded?.status()).toBe(200);
  await expect(
    publicPage.getByRole("heading", { name: username, exact: true }),
  ).toBeVisible();
  for (const unknown of ["unknown_player", "unknown.player"]) {
    const missing = await publicPage.goto(`/u/${unknown}`);
    expect(missing?.status()).toBe(404);
    await expect(
      publicPage.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
  }
  await visitor.close();

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Export journal" }),
  ).toBeVisible();
  const exportedResponse = await page.request.get("/api/account/export");
  expect(exportedResponse.status()).toBe(200);
  expect(exportedResponse.headers()["cache-control"]).toBe("private, no-store");
  expect(exportedResponse.headers()["content-disposition"]).toContain(
    "attachment;",
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("shelve-games.json");
  const exported = JSON.parse(
    await readFile((await download.path()) ?? "", "utf8"),
  );
  expect(exported.profile).toMatchObject({ email, username });
  expect(exported.entries).toHaveLength(2);
  expect(exported.statusHistory).toHaveLength(4);
  expect(exported.playthroughs).toEqual([
    expect.objectContaining({
      notes: privateNote,
      hours: 12,
      startedOn: "2026-01-01",
      endedOn: "2026-01-10",
    }),
  ]);

  const deleteButton = page.getByRole("button", {
    name: "Permanently delete account",
  });
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("delete");
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("");
  for (const [name, width, height, theme] of [
    ["account-settings-desktop", 1440, 1000, "light"],
    ["account-settings-dark", 1440, 1000, "dark"],
    ["account-settings-mobile", 390, 844, "light"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme);
    }, theme);
    await page.reload();
    await expect(deleteButton).toBeDisabled();
    const screenshot = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach(name, { path: screenshot, contentType: "image/png" });
  }
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await expect(deleteButton).toBeEnabled();
  const confirmationScreenshot = testInfo.outputPath(
    "account-delete-confirmation.png",
  );
  await page.screenshot({ path: confirmationScreenshot, fullPage: true });
  await testInfo.attach("Typed deletion confirmation", {
    path: confirmationScreenshot,
    contentType: "image/png",
  });
  const staleSession = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  await deleteButton.click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/account/export")).status()).toBe(401);
  expect((await staleSession.request.get("/api/account/export")).status()).toBe(
    401,
  );
  expect((await page.request.get(`/u/${username}`)).status()).toBe(404);
  expect((await page.request.get("/games/celeste")).status()).toBe(200);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
  await staleSession.close();
});
