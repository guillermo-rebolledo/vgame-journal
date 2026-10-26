import { expect, test } from "@playwright/test";

test("sign up, build a journal, and share a read-only public profile without notes", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const username = `player_${Date.now()}`;
  const email = `${username}@example.com`;
  const privateNote = "PRIVATE_NOTE_only_the_owner_should_see_this";
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();

  const mailbox = await (
    await request.get("http://127.0.0.1:3101/mailbox")
  ).json();
  const verification = mailbox.findLast(
    (mail: { to: string }) => mail.to === email,
  );
  const link = verification.text.match(/https?:\S+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
  await page.getByRole("link", { name: /Celeste/ }).click();
  await page.getByRole("button", { name: /^wishlist$/i }).click();
  await expect(
    page.getByRole("button", { name: /^wishlist$/i }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: /^wishlist$/i }).click();
  await expect(
    page
      .getByRole("list", { name: /^wishlist$/i })
      .getByRole("link", { name: /Celeste/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Celeste/ }).click();
  await page.getByRole("button", { name: /^played$/i }).click();
  await page.getByRole("button", { name: /^completed$/i }).click();
  await expect(
    page.getByRole("button", { name: /^completed$/i }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Finished", { exact: true }).fill("2026-01-10");
  await page.getByLabel("Hours", { exact: true }).fill("12");
  await page.getByLabel("Notes (private)", { exact: true }).fill(privateNote);
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: privateNote }),
  ).toBeVisible();

  // Keep a second game on the wishlist to exercise its public read-only state.
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search games" }).fill("Silksong");
  await page.getByRole("link", { name: /Silksong/ }).click();
  await page.getByRole("button", { name: /^wishlist$/i }).click();
  await expect(
    page.getByRole("button", { name: /^wishlist$/i }),
  ).toHaveAttribute("aria-pressed", "true");

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
      name: "Celeste Played · Completed",
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

  const missing = await publicPage.goto("/u/unknown_player");
  expect(missing?.status()).toBe(404);
  await expect(
    publicPage.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await visitor.close();
});
