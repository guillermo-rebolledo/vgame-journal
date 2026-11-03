import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";

for (const theme of ["dark", "light"] as const) {
  test(`spec 78: guest and returning Home remain readable in ${theme}`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await chooseTheme(page, theme);
    const search = page.getByRole("search", {
      name: "Search games",
      exact: true,
    });
    await expect(
      search.getByLabel("Search games", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Track",
    );
    const signup = page.getByRole("link", {
      name: "Sign up to start a Journal",
    });
    const example = page.getByRole("figure", { name: "Example Journal" });
    await expect(example).toContainText("Backlog");
    await expect(example).toContainText("Wishlist");
    expect(
      await signup.evaluate((node) => {
        const figure = document.querySelector(
          'figure[aria-label="Example Journal"]',
        );
        return (
          !!figure &&
          !!(
            node.compareDocumentPosition(figure) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
        );
      }),
    ).toBe(true);
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [768, 1024],
      [1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      for (const fontSize of [16, 32]) {
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}px`;
        }, fontSize);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "16px";
      });
      if (width === 390 || width === 1440)
        await snap(page, testInfo, `guest-${theme}-${width}`, true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await signUp(page, request, `home78_${theme}_${Date.now()}`);
    await expect(
      page.getByRole("link", { name: "All saved games (0)", exact: true }),
    ).toBeVisible();
    await snap(page, testInfo, `empty-${theme}-390`, true);
    await page.goto("/games/celeste");
    await chooseStatus(page, "playing");
    await page.goto("/");
    await expect(
      page
        .getByRole("region", { name: "Playing", exact: true })
        .getByRole("link", { name: /Celeste/ }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Recently added", exact: true })
        .getByRole("link", { name: /Celeste/ }),
    ).toBeVisible();
    await snap(page, testInfo, `one-entry-${theme}-390`, true);
    await page.goto("/games/silksong");
    await chooseStatus(page, "wishlist");
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "All saved games (2)", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Wishlist (1)", exact: true }),
    ).toBeVisible();
    for (const [width, height] of [
      [390, 844],
      [1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await snap(page, testInfo, `returning-${theme}-${width}`, true);
    }
  });
}

test("spec 78: Home browsing survives signup, verification, onboarding and sign-in retry without saving", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const destination = "/?q=Celeste&year=2018&platform=PC&all=1&filters=1";
  await page.goto(destination);
  const signup = page.getByRole("link", { name: "Sign up to start a Journal" });
  const href = await signup.getAttribute("href");
  expect(new URL(href ?? "", page.url()).searchParams.get("returnTo")).toBe(
    destination,
  );
  await signup.click();
  const signIn = page
    .getByRole("main")
    .getByRole("link", { name: "Sign in", exact: true });
  expect(
    new URL(
      (await signIn.getAttribute("href")) ?? "",
      page.url(),
    ).searchParams.get("returnTo"),
  ).toBe(destination);
  await signIn.click();
  await page.getByRole("link", { name: "Create an account" }).click();
  const username = `context78_${Date.now()}`;
  const email = `${username}@example.com`;
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
  expect(new URL(link).searchParams.get("callbackURL")).toBe(destination);
  await page.goto(link);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(destination);
  await expect(
    page.getByRole("searchbox", { name: "Search games" }),
  ).toHaveValue("Celeste");
  await expect(page.getByLabel("Release year", { exact: true })).toHaveValue(
    "2018",
  );
  await expect(page.getByLabel("Platform", { exact: true })).toHaveValue("PC");
  await page.context().clearCookies();
  await page.goto(destination);
  await page.getByRole("link", { name: "Sign in to your Journal" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(destination);
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.entries).toEqual([]);
  expect(exported.statusHistory).toEqual([]);
  expect(exported.playthroughs).toEqual([]);
});
