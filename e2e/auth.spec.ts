import { expect, test } from "@playwright/test";

test("signed-out visitors see Sign in and can't reach onboarding", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create an account" }),
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("signed-out visitors cannot reach personal stats", async ({ page }) => {
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("R10 guest recording returns an existing member to the game after retry without writes", async ({
  page,
  request,
}) => {
  const { signUp } = await import("./support/sign-up");
  const email = await signUp(page, request, `continuation_${Date.now()}`);
  await page.context().clearCookies();
  await page.goto("/games/celeste");
  const journal = page.getByRole("region", { name: "Game journal" });
  for (const name of ["Journal status", "Add playthrough", "Sign in"])
    await expect(
      journal.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", "/sign-in?returnTo=%2Fgames%2Fceleste");
  await journal
    .getByRole("link", { name: "Journal status", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  await expect(page).toHaveURL("/sign-in?returnTo=%2Fgames%2Fceleste");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(
    page.getByRole("button", { name: "Sign in with email" }),
  ).toBeEnabled();
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL("/games/celeste");
  await expect(
    page.getByRole("button", { name: "Journal status", exact: true }),
  ).toHaveAttribute("aria-description", "Not in your journal");
  await expect(journal.getByText("No playthroughs yet.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.entries).toEqual([]);
  expect(exported.statusHistory).toEqual([]);
  expect(exported.playthroughs).toEqual([]);

  for (const value of [null, "/%255cevil.example", "/onboarding"]) {
    await page.context().clearCookies();
    const query =
      value === null ? "" : `?${new URLSearchParams({ returnTo: value })}`;
    await page.goto(`/sign-in${query}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByRole("button", { name: "Sign in with email" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByText("Your Journal is empty.").filter({ visible: true }),
    ).toBeVisible();
  }
});

test("R10 signup switching, verification resend and username retry preserve the game without writes", async ({
  page,
  request,
}) => {
  const username = `new_game_${Date.now()}`;
  const email = `${username}@example.com`;
  const destination = "?returnTo=%2Fgames%2Fceleste";
  await page.goto("/games/celeste");
  await page
    .getByRole("link", { name: "Add playthrough", exact: true })
    .click();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(`/sign-up${destination}`);
  await expect(
    page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", `/sign-in${destination}`);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(`/sign-in${destination}`);
  await page.getByRole("link", { name: "Create an account" }).click();

  await page.route(
    "**/api/auth/sign-up/email",
    (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          code: "TEST_FAILURE",
          message: "Try signup again.",
        }),
      }),
    { times: 1 },
  );
  await page.getByLabel("Name", { exact: true }).fill("Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Try signup again.",
  );
  await expect(
    page.getByRole("button", { name: "Sign up", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Player");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(page).toHaveURL(`/sign-up${destination}`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();

  // An unverified sign-in sends a fresh verification link with the same callback.
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
  const mailbox = await (
    await request.get("http://127.0.0.1:3101/mailbox")
  ).json();
  const verification = mailbox.filter(
    (mail: { to: string }) => mail.to === email,
  );
  expect(verification).toHaveLength(2);
  for (const mail of verification) {
    const link = mail.text.match(/https?:\S+/)?.[0];
    expect(new URL(link).searchParams.get("callbackURL")).toBe(
      "/games/celeste",
    );
  }
  await page.goto(verification[1].text.match(/https?:\S+/)[0]);
  await expect(page).toHaveURL(`/onboarding${destination}`);
  await page.getByLabel("Username", { exact: true }).fill("ab");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    /too short/i,
  );
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await expect(page).toHaveURL(`/onboarding${destination}`);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("/games/celeste");
  await expect(
    page.getByRole("button", { name: "Journal status", exact: true }),
  ).toHaveAttribute("aria-description", "Not in your journal");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.entries).toEqual([]);
  expect(exported.statusHistory).toEqual([]);
  expect(exported.playthroughs).toEqual([]);
});

const continuations: [string | null, string][] = [
  [null, "/"],
  ["/games/celeste", "/games/celeste"],
  ["https://evil.example/game", "/"],
  ["//evil.example", "/"],
  ["/\\evil.example", "/"],
  ["/%2fevil.example", "/"],
  ["/%255cevil.example", "/"],
  ["/%0devil.example", "/"],
  ["/games/%2e%2e/onboarding", "/"],
  ["/sign-in?returnTo=/games/celeste", "/"],
  ["/api/auth/sign-in", "/"],
];

// Capture the real client's outgoing public auth requests, with no live provider/network call.
test("R10 email, signup and Google callback construction validate destinations independently", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.route("**/api/auth/sign-in/*", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "TEST_FAILURE", message: "Try again." }),
    }),
  );
  await page.route("**/api/auth/sign-up/email", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "TEST_FAILURE", message: "Try again." }),
    }),
  );
  for (const [value, expected] of continuations) {
    const query = new URLSearchParams({ notice: "kept" });
    if (value !== null) query.set("returnTo", value);
    await page.goto(`/sign-in?${query}`);
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute(
      "href",
      expected === "/" ? "/sign-up" : "/sign-up?returnTo=%2Fgames%2Fceleste",
    );
    const social = page.waitForRequest("**/api/auth/sign-in/social");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const socialBody = (await social).postDataJSON();
    const errorDestination =
      expected === "/" ? "/sign-in" : "/sign-in?returnTo=%2Fgames%2Fceleste";
    expect(socialBody).toMatchObject({
      provider: "google",
      callbackURL: expected,
      errorCallbackURL: errorDestination,
    });
    // Replay the provider's error landing; the auth-handler test covers state/cookies.
    const cancellation = new URL(socialBody.errorCallbackURL, page.url());
    cancellation.searchParams.set("error", "access_denied");
    await page.goto(cancellation.href);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    const retry = page.waitForRequest("**/api/auth/sign-in/social");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    expect((await retry).postDataJSON()).toMatchObject({
      provider: "google",
      callbackURL: expected,
      errorCallbackURL: errorDestination,
    });
    await page
      .getByLabel("Email", { exact: true })
      .fill("boundary@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    const email = page.waitForRequest("**/api/auth/sign-in/email");
    await page.getByRole("button", { name: "Sign in with email" }).click();
    expect((await email).postDataJSON().callbackURL).toBe(expected);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Try again.",
    );
    await expect(page).toHaveURL(cancellation.href);

    await page.goto(`/sign-up?${query}`);
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute(
      "href",
      expected === "/" ? "/sign-in" : "/sign-in?returnTo=%2Fgames%2Fceleste",
    );
    await page.getByLabel("Name", { exact: true }).fill("Player");
    await page
      .getByLabel("Email", { exact: true })
      .fill("boundary@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    const signup = page.waitForRequest("**/api/auth/sign-up/email");
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    expect((await signup).postDataJSON().callbackURL).toBe(expected);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Try again.",
    );
    await expect(page).toHaveURL(`/sign-up?${query}`);
  }
});

test("R10 username selection and both session gates reject unsafe continuations", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const username = `safe_home_${Date.now()}`;
  const email = `${username}@example.com`;
  // Arrange an existing verified member who still needs to claim a username.
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Player", email, password: "password123", callbackURL: "/" },
  });
  expect(signup.ok()).toBe(true);
  const mailbox = await (
    await request.get("http://127.0.0.1:3101/mailbox")
  ).json();
  const verification = mailbox.findLast(
    (mail: { to: string }) => mail.to === email,
  );
  await page.goto(verification.text.match(/https?:\S+/)[0]);
  await expect(page).toHaveURL("/onboarding");
  await page.goto("/sign-in?returnTo=%2Fgames%2Fceleste");
  await expect(page).toHaveURL("/onboarding?returnTo=%2Fgames%2Fceleste");
  await page.goto("/games/celeste");
  await expect(page).toHaveURL("/onboarding?returnTo=%2Fgames%2Fceleste");
  const blocked = await page.request.get("/api/account/export");
  expect(blocked.status()).toBe(403);
  await page.goto("/onboarding?returnTo=%2F%255cevil.example");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByText("Your Journal is empty.").filter({ visible: true }),
  ).toBeVisible();

  for (const [value, expected] of continuations) {
    const query =
      value === null ? "" : `?${new URLSearchParams({ returnTo: value })}`;
    await page.goto(`/onboarding${query}`);
    await expect(page).toHaveURL(expected);
  }
  await page.context().clearCookies();
  for (const [value, expected] of continuations) {
    const query =
      value === null ? "" : `?${new URLSearchParams({ returnTo: value })}`;
    await page.goto(`/onboarding${query}`);
    await expect(page).toHaveURL(
      expected === "/" ? "/sign-in" : "/sign-in?returnTo=%2Fgames%2Fceleste",
    );
  }
});
