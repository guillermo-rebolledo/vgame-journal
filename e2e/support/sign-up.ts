import { type APIRequestContext, expect, type Page } from "@playwright/test";

/** Signs up with email, follows the verification mail, and claims `username`; ends on Home. */
export async function signUp(
  page: Page,
  request: APIRequestContext,
  username: string,
) {
  const email = `${username}@example.com`;
  await page.goto("/sign-up");
  // Parallel specs can trip Better Auth's sign-up rate limit; wait out its 10s window.
  for (let attempt = 0; attempt < 4; attempt++) {
    // The form resets after each submit.
    await page.getByLabel("Name", { exact: true }).fill("Player");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    const response = page.waitForResponse((r) =>
      r.url().includes("/api/auth/sign-up"),
    );
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    if ((await response).status() !== 429) break;
    await page.waitForTimeout(10_000);
  }
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
  return email;
}
