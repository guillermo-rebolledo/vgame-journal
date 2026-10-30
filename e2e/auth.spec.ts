import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { signUp } from "./support/sign-up";

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

// F11 / R11: known unusable links must not ask for a replacement password.
test("missing and known-invalid reset links immediately offer a new link", async ({
  page,
}) => {
  for (const path of [
    "/reset-password",
    "/reset-password?token=&error=INVALID_TOKEN",
    "/reset-password?token=unusable&error=INVALID_TOKEN",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "invalid or expired",
    );
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("link", { name: "Request a new reset link" }).click();
    await expect(
      page.getByRole("heading", { name: "Reset your password" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  }
});

// A token-shaped string is not proof of a usable reset link.
test("submission-time invalid reset tokens offer recovery without a success notice", async ({
  page,
}) => {
  await page.goto("/reset-password?token=unknown-token");
  await page.getByLabel("New password", { exact: true }).fill("replacement123");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "invalid or expired",
  );
  await expect(page).toHaveURL(/\/reset-password\?/);
  await expect(
    page.getByText("Password updated. Sign in with your new password."),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

// F15 / R15: browser hints and service rejection must describe the same bounds.
test("new-account passwords explain length errors and retain nonsecret fields", async ({
  page,
  request,
}) => {
  const email = `password_policy_${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Retained Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAccessibleDescription("Use 8–128 characters.");
  await expect(password).toHaveAttribute("minlength", "8");
  await expect(password).toHaveAttribute("maxlength", "128");
  // Bypass only browser constraints to exercise the authoritative service.
  await password.evaluate((input) => {
    input.removeAttribute("minlength");
    input.removeAttribute("maxlength");
  });
  for (const [value, message] of [
    ["x".repeat(7), "Password must be at least 8 characters."],
    ["x".repeat(129), "Password must be no more than 128 characters."],
  ]) {
    await password.fill(value);
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(message);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Retained Player",
    );
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    await expect(password).toHaveValue("");
  }
  const mailbox = await (
    await request.get("http://127.0.0.1:3101/mailbox")
  ).json();
  expect(mailbox.filter((mail: { to: string }) => mail.to === email)).toEqual(
    [],
  );
  await password.fill("abcdefgh");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Maximum length");
  await page.getByLabel("Email", { exact: true }).fill(`max_${email}`);
  await page.getByLabel("Password", { exact: true }).fill("x".repeat(128));
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check max_${email} for a link to verify your email.`),
  ).toBeVisible();
});

async function requestResetLink(
  page: Page,
  request: APIRequestContext,
  email: string,
) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(
    page.getByText(`If ${email} has an account, a reset link is on its way.`),
  ).toBeVisible();
  const mailbox = await (
    await request.get("http://127.0.0.1:3101/mailbox")
  ).json();
  const mail = mailbox.findLast(
    (mail: { to: string; subject: string }) =>
      mail.to === email && mail.subject.startsWith("Reset "),
  );
  const link = mail.text.match(/https?:\S+/)?.[0];
  expect(link).toBeTruthy();
  return link as string;
}

// F11 / F15 / F17: real captured email, service expiry and replacement login.
test("expired resets preserve the old password and a replacement reset acknowledges success before login", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, `reset_${Date.now()}`);
  const replacement = "n".repeat(128);
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await expect(
    page.getByText("Password updated. Sign in with your new password."),
  ).toHaveCount(0);
  await page.goto("/forgot-password?returnTo=%2Fgames%2Fceleste");
  await page.goto(await requestResetLink(page, request, email));
  const expiredToken = new URL(page.url()).searchParams.get("token");
  expect(expiredToken).toBeTruthy();
  const expired = await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: "update verification set expires_at = $1 where identifier = $2 returning id",
      params: ["2000-01-01T00:00:00.000Z", `reset-password:${expiredToken}`],
    },
  });
  expect(expired.ok()).toBe(true);
  expect((await expired.json()).rows).toHaveLength(1);
  await page.getByLabel("New password", { exact: true }).fill(replacement);
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "invalid or expired",
  );
  const signIn = (password: string) =>
    request.post("/api/auth/sign-in/email", {
      data: { email, password },
      headers: { origin: "http://localhost:3100" },
    });
  expect((await signIn("password123")).ok()).toBe(true);
  expect((await signIn(replacement)).status()).toBe(401);
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await expect(page).toHaveURL("/forgot-password?returnTo=%2Fgames%2Fceleste");
  await page.goto(await requestResetLink(page, request, email));
  const validResetURL = page.url();
  const password = page.getByLabel("New password", { exact: true });
  await expect(password).toHaveAccessibleDescription("Use 8–128 characters.");
  await expect(password).toHaveAttribute("minlength", "8");
  await expect(password).toHaveAttribute("maxlength", "128");
  await password.evaluate((input) => {
    input.removeAttribute("minlength");
    input.removeAttribute("maxlength");
  });
  for (const [value, message] of [
    ["x".repeat(7), "Password must be at least 8 characters."],
    ["x".repeat(129), "Password must be no more than 128 characters."],
  ]) {
    await password.fill(value);
    await page
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(message);
    await expect(password).toHaveValue("");
    expect((await signIn("password123")).ok()).toBe(true);
  }
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received!: () => void;
  const responseReceived = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route("**/api/auth/reset-password", async (route) => {
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await password.fill(replacement);
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  try {
    await responseReceived;
    await expect(
      page.getByRole("button", { name: "Reset password", exact: true }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\/reset-password\?/);
    await expect(
      page.getByText("Password updated. Sign in with your new password."),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page).toHaveURL(
    "/sign-in?returnTo=%2Fgames%2Fceleste&passwordReset=success",
  );
  await expect(page.getByRole("status")).toHaveText(
    "Password updated. Sign in with your new password.",
  );
  const browserState = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      history: history.state,
    }),
  );
  expect(browserState.includes(replacement)).toBe(false);
  expect(
    browserState.includes(
      new URL(validResetURL).searchParams.get("token") ?? "missing-token",
    ),
  ).toBe(false);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(replacement);
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(page).toHaveURL("/games/celeste");
  expect((await signIn("password123")).status()).toBe(401);
  await page.context().clearCookies();
  await page.goto(validResetURL);
  await page.getByLabel("New password", { exact: true }).fill("abcdefgh");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "invalid or expired",
  );
  expect((await signIn(replacement)).ok()).toBe(true);
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await page.goto(await requestResetLink(page, request, email));
  await page.getByLabel("New password", { exact: true }).fill("abcdefgh");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Password updated. Sign in with your new password.",
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("abcdefgh");
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(page).toHaveURL("/games/celeste");
  expect((await signIn(replacement)).status()).toBe(401);
});

// Preserve the existing auth layout while adding guidance and recovery feedback.
test("password recovery pages reflow with enlarged text and both themes", async ({
  page,
}) => {
  for (const theme of ["light", "dark"]) {
    for (const path of [
      "/sign-in?returnTo=%2Fgames%2Fceleste&passwordReset=success",
      "/sign-up",
      "/forgot-password",
      "/reset-password?token=unverified",
      "/reset-password",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (!(await page.locator("html").getAttribute("class"))?.includes(theme))
        await page.getByRole("button", { name: "Toggle theme" }).click();
      for (const [width, fontSize] of [
        [320, 16],
        [320, 32],
        [390, 16],
        [1440, 16],
        [2560, 16],
      ]) {
        await page.setViewportSize({ width, height: 740 });
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}px`;
        }, fontSize);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        const action = page.getByRole("main").getByRole("button").first();
        if (await action.count()) {
          await action.scrollIntoViewIfNeeded();
          await expect(action).toBeVisible();
        } else {
          const recovery = page.getByRole("link", {
            name: "Request a new reset link",
          });
          await recovery.scrollIntoViewIfNeeded();
          await expect(recovery).toBeVisible();
        }
      }
    }
  }
});
