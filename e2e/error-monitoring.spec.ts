import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("isolated production builds expose no browser maps or Sentry traffic", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/sentry\.io/.test(request.url())) requests.push(request.url());
  });
  const response = await page.goto("/privacy");
  expect(
    response?.headers()["content-security-policy-report-only"],
  ).not.toContain("sentry.io");
  await expect(
    page.getByRole("heading", { name: "Error diagnostics" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Account settings", exact: true })
    .click();
  await expect(page).toHaveURL(/sign-in/);
  expect(requests).toEqual([]);
  const root = path.resolve(".next-e2e/static");
  const files = await readdir(root, { recursive: true });
  expect(files.filter((file) => file.endsWith(".map"))).toEqual([]);
  for (const file of files.filter((file) => file.endsWith(".js"))) {
    const code = await readFile(path.join(root, file), "utf8");
    expect(code).not.toContain("sentry-e2e-upload-token-sentinel");
    // Generated maps must not have reachable public sourceMappingURL targets.
    expect(code).not.toMatch(/\/\/# sourceMappingURL=.*\.map(?:\s|$)/);
  }
});
