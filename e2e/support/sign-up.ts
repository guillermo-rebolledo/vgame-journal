import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { supportUrl } from "./url";

/** Retries and repeats share a database, so each test attempt needs fresh accounts. */
export function uniqueUsername(prefix: string) {
  return `${prefix.slice(0, 21)}_${randomUUID().slice(0, 8)}`;
}

/** Signs up with email, follows the verification mail, and claims `username`; ends on Home. */
export async function signUp(
  page: Page,
  request: APIRequestContext,
  username: string,
) {
  const email = `${username}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();

  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const verification = mailbox.findLast(
    (mail: { to: string }) => mail.to === email,
  );
  const link = verification.text.match(/https?:\S+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link);
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page
      .getByText(/Your profile is Private: only you can open it/)
      .filter({ visible: true }),
  ).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("/");
  return email;
}
