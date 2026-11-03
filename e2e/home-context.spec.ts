import { expect, test } from "@playwright/test";
import { supportUrl } from "./support/url";

// The search workstream owns the disclosure and candidate rendering; this exercises
// the real Home/auth continuation flow using its existing controlled-request seam.
test("Home browsing survives account switching, verification, onboarding and sign-in retry without saves", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/games/search?**", (route) =>
    route.fulfill({
      json: Array.from({ length: 9 }, (_, i) => ({
        id: 78000 + i,
        title: `Home fixture ${i}`,
        slug: `home-fixture-${i}`,
        coverImageId: null,
        year: i < 8 ? 2027 : 2026,
        platforms: [i < 8 ? "PC" : "PlayStation 5"],
      })),
    }),
  );
  const home = "/?q=Home&year=2027&platform=PC&all=1&filters=1";
  await page.goto(home);
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("listitem")).toHaveCount(8);
  await expect(page.getByLabel("Release year", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Platform", { exact: true })).toBeVisible();
  const signup = page.getByRole("link", { name: "Sign up to start a Journal" });
  const example = page.getByRole("figure", { name: "Example Journal" });
  await expect(example.getByText("Backlog", { exact: true })).toBeVisible();
  await expect(example.getByText("Wishlist", { exact: true })).toBeVisible();
  expect((await signup.boundingBox())?.y).toBeLessThan(
    (await example.boundingBox())?.y ?? 0,
  );
  const destination = `?${new URLSearchParams({ returnTo: home })}`;
  // Both shared-header entry points use the current browsing URL too.
  await page
    .locator("header")
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(`/sign-in${destination}`);
  await page.goto(home);
  await page
    .locator("header")
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`/sign-in${destination}`);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(`/sign-up${destination}`);
  await page.goto(home);
  await signup.click();
  await expect(page).toHaveURL(`/sign-up${destination}`);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(`/sign-in${destination}`);
  await page.getByRole("link", { name: "Create an account" }).click();

  const username = `home78_${Date.now()}`;
  const email = `${username}@example.com`;
  await page.getByLabel("Name", { exact: true }).fill("Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Verify your email first",
  );
  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const verification = mailbox.filter(
    (mail: { to: string }) => mail.to === email,
  );
  expect(verification).toHaveLength(2);
  for (const mail of verification) {
    const link = mail.text.match(/https?:\S+/)[0];
    expect(new URL(link).searchParams.get("callbackURL")).toBe(home);
  }
  await page.goto(verification[1].text.match(/https?:\S+/)[0]);
  await expect(page).toHaveURL(`/onboarding${destination}`);
  await page.getByLabel("Username", { exact: true }).fill("ab");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    /too short/i,
  );
  await expect(page).toHaveURL(`/onboarding${destination}`);
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(home);
  await expect(results.getByRole("listitem")).toHaveCount(8);
  await expect(
    page.getByRole("link", { name: "All saved games (0)" }),
  ).toBeVisible();

  await page.context().clearCookies();
  await page.goto(home);
  await page.getByRole("link", { name: "Sign in to your Journal" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  await expect(page).toHaveURL(`/sign-in${destination}`);
  await expect(
    page.getByRole("button", { name: "Sign in with email" }),
  ).toBeEnabled();
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(home);
  await expect(results.getByRole("listitem")).toHaveCount(8);
  await expect(page.getByLabel("Release year", { exact: true })).toHaveValue(
    "2027",
  );
  await expect(page.getByLabel("Platform", { exact: true })).toHaveValue("PC");
  await expect(page.getByLabel("Release year", { exact: true })).toBeVisible();
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.entries).toEqual([]);
  expect(exported.statusHistory).toEqual([]);
  expect(exported.playthroughs).toEqual([]);
});
