import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";
import { supportUrl } from "./support/url";

test("feedback stores real submissions, opens from the account menu, and limits the sixth message", async ({
  page,
  request,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Send feedback" })).toHaveCount(
    0,
  );
  const username = `feedback${Date.now()}`;
  await signUp(page, request, username);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Library", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("button", { name: "Send feedback" }),
  ).toHaveCount(0);
  const account = page.getByRole("button", {
    name: `Account menu, @${username}`,
  });
  await account.click();
  await expect(
    page.getByRole("menuitem", { name: "Feedback", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await snap(page, testInfo, "feedback-mobile-header");
  for (let i = 0; i < 6; i++) {
    await account.click();
    await page.getByRole("menuitem", { name: "Feedback", exact: true }).click();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
    if (i === 0) {
      await page.getByRole("combobox", { name: "Type", exact: true }).click();
      await page.getByRole("option", { name: "Bug", exact: true }).click();
    }
    await page.getByLabel("Message", { exact: true }).fill(`Feedback ${i}`);
    if (i === 0) await snap(page, testInfo, "feedback-mobile-form");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    if (i < 5) {
      await expect(
        page.getByRole("heading", { name: "Thanks, got it." }),
      ).toBeVisible();
      if (i === 0) await snap(page, testInfo, "feedback-success");
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(account).toBeFocused();
    } else {
      await expect(page.getByRole("alert")).toContainText(
        "You’ve sent 5 messages",
      );
      await snap(page, testInfo, "feedback-rate-limit");
    }
  }
  const stored = await (
    await request.post(supportUrl("/query"), {
      data: {
        sql: 'select f.type, f.message, f.path from feedback f join "user" u on f.user_id = u.id where u.username = $1 order by f.id',
        params: [username],
      },
    })
  ).json();
  expect(stored.rows).toHaveLength(5);
  expect(stored.rows[0]).toEqual(["bug", "Feedback 0", "/library"]);
  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const notifications = mailbox.filter((mail: { subject: string }) =>
    mail.subject.endsWith(`@${username}`),
  );
  expect(notifications).toHaveLength(5);
  expect(notifications[0]).toMatchObject({
    to: "delivered@resend.dev",
    reply_to: `${username}@example.com`,
    subject: `[Feedback: Bug] @${username}`,
    text: `Username: @${username}\nType: Bug\nPath: /library\n\nFeedback 0`,
  });
});

test("empty Journal invites confusion reports, preserves category drafts and restores focus", async ({
  page,
  request,
}) => {
  await signUp(page, request, `friction${Date.now()}`);
  await page.goto("/");
  const invitation = page.getByRole("button", {
    name: "Something confusing or missing?",
    exact: true,
  });
  await invitation.click();
  await expect(
    page.getByText("What do you want to do, and how would it help?"),
  ).toBeVisible();
  await expect(
    page.getByText(/private to the team and relevant processors/),
  ).toBeVisible();
  await page
    .getByLabel("Message", { exact: true })
    .fill("I cannot find my games.");
  await page.getByRole("combobox", { name: "Type", exact: true }).click();
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await expect(
    page.getByText("Tell us about anything confusing or hard to use."),
  ).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "I cannot find my games.",
  );
  await page.keyboard.press("Escape");
  await expect(invitation).toBeFocused();
});

test("public support is available before account setup and never includes return tokens", async ({
  page,
}) => {
  for (const path of [
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password?token=private-reset&returnTo=%2Fu%2Fprivate",
    "/reset-password",
    "/onboarding?returnTo=%2Fsecret",
  ]) {
    await page.goto(path);
    const contacts = page.getByRole("link", {
      name: "Contact support",
      exact: true,
    });
    await expect(contacts.first()).toBeVisible();
    for (const contact of await contacts.all()) {
      await expect(contact).toHaveAttribute(
        "href",
        "mailto:memorebo.dev@gmail.com?subject=Help%20with%20shelve.games",
      );
    }
  }
});

test("feedback retains server-rejected and offline drafts, retries, and rejects guests", async ({
  page,
  request,
  browser,
}) => {
  const username = `retry${Date.now()}`;
  await signUp(page, request, username);
  await page.goto("/library?token=secret#private");
  await page
    .getByRole("button", { name: "Something confusing or missing?" })
    .click();
  const message = page.getByLabel("Message", { exact: true });
  await message.evaluate((element) => element.removeAttribute("maxlength"));
  await message.fill("x".repeat(2001));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("between 1 and 2000");
  await expect(message).toHaveValue("x".repeat(2001));
  await message.fill("Keep this until sent.");
  await page.route("**/library?**", async (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your message is still here",
  );
  await expect(message).toHaveValue("Keep this until sent.");
  await page.unroute("**/library?**");
  const submission = page.waitForRequest(
    (req) => req.method() === "POST" && !!req.headers()["next-action"],
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const sent = await submission;
  await expect(
    page.getByRole("heading", { name: "Thanks, got it." }),
  ).toBeVisible();
  const guest = await browser.newContext();
  try {
    const response = await guest.request.post(sent.url(), {
      headers: {
        "next-action": sent.headers()["next-action"],
        "content-type": sent.headers()["content-type"],
        origin: new URL(sent.url()).origin,
      },
      data: sent.postData() ?? "",
    });
    expect(await response.text()).toContain(
      "Sign in with a username to send feedback.",
    );
  } finally {
    await guest.close();
  }
  const stored = await (
    await request.post(supportUrl("/query"), {
      data: {
        sql: 'select f.path, f.message from feedback f join "user" u on u.id=f.user_id where u.username=$1',
        params: [username],
      },
    })
  ).json();
  expect(stored.rows).toEqual([["/library", "Keep this until sent."]]);
});

test("first successful save invites once, persists dismissal across sessions, and survives deletion", async ({
  page,
  request,
  browser,
}) => {
  await signUp(page, request, `firstsave${Date.now()}`);
  await page.goto("/games/celeste");
  await expect(
    page.getByRole("complementary", { name: "First game feedback" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "First game feedback" }),
  ).toHaveCount(0);
  await page.route("**/games/celeste", async (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: /^Add to Journal for/ }).click();
  await page
    .getByRole("menuitemradio", { name: "backlog", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Couldn’t update your journal",
  );
  await expect(
    page.getByRole("complementary", { name: "First game feedback" }),
  ).toHaveCount(0);
  await page.unroute("**/games/celeste");
  await page.keyboard.press("Escape");
  await chooseStatus(page, "backlog");
  await expect(
    page.getByRole("complementary", { name: "First game feedback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss invitation" }).click();
  await page.reload();
  await expect(
    page.getByRole("complementary", { name: "First game feedback" }),
  ).toHaveCount(0);
  const other = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const tab = await other.newPage();
    await tab.goto("/games/celeste");
    await chooseStatus(tab, "playing");
    await expect(
      tab.getByRole("complementary", { name: "First game feedback" }),
    ).toHaveCount(0);
    await tab.getByRole("button", { name: /Change Journal status/ }).click();
    await tab
      .getByRole("menuitem", { name: "Remove from journal", exact: true })
      .click();
    await expect(
      tab.getByRole("button", { name: /^Add to Journal for/ }),
    ).toBeVisible();
    await chooseStatus(tab, "backlog");
    await expect(
      tab.getByRole("complementary", { name: "First game feedback" }),
    ).toHaveCount(0);
    await tab.getByRole("button", { name: /Account menu/ }).click();
    await expect(
      tab.getByRole("menuitem", { name: "Feedback", exact: true }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("an unclaimed old-version first insertion never invites on later Status saves or re-add", async ({
  page,
  request,
}) => {
  const username = `unclaimed${Date.now()}`;
  await signUp(page, request, username);
  // Simulate the old deployment committing its insert without claiming an invitation.
  const seeded = await request.post(supportUrl("/query"), {
    data: {
      sql: `insert into journal_entry (user_id, game_id, status, updated_at)
            select u.id, g.id, 'backlog', now() from "user" u cross join game g
            where u.username = $1 and g.slug = 'celeste' returning game_id`,
      params: [username],
    },
  });
  expect((await seeded.json()).rows).toHaveLength(1);
  await page.goto("/games/celeste");
  await chooseStatus(page, "playing");
  await expect(
    page.getByRole("complementary", { name: "First game feedback" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Change Journal status/ }).click();
  await page
    .getByRole("menuitem", { name: "Remove from journal", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Add to Journal for/ }),
  ).toBeVisible();
  await chooseStatus(page, "backlog");
  await expect(
    page.getByRole("complementary", { name: "First game feedback" }),
  ).toHaveCount(0);
});

test("concurrent first saves show one invitation across browser sessions", async ({
  page,
  request,
  browser,
}) => {
  await signUp(page, request, `concurrent${Date.now()}`);
  const other = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const tab = await other.newPage();
    await Promise.all([
      page.goto("/games/celeste"),
      tab.goto("/games/silksong"),
    ]);
    await Promise.all([
      chooseStatus(page, "backlog"),
      chooseStatus(tab, "wishlist"),
    ]);
    await expect
      .poll(
        async () =>
          (await page
            .getByRole("complementary", { name: "First game feedback" })
            .count()) +
          (await tab
            .getByRole("complementary", { name: "First game feedback" })
            .count()),
      )
      .toBe(1);
    await Promise.all([page.reload(), tab.reload()]);
    await expect(
      page.getByRole("complementary", { name: "First game feedback" }),
    ).toHaveCount(0);
    await expect(
      tab.getByRole("complementary", { name: "First game feedback" }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("authenticated pre-username players have public support without access to Feedback", async ({
  page,
  request,
}) => {
  const email = `preusername${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Player");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByText(`Check ${email} for a link to verify your email.`),
  ).toBeVisible();
  const mailbox = await (await request.get(supportUrl("/mailbox"))).json();
  const mail = mailbox.findLast((item: { to: string }) => item.to === email);
  await page.goto(mail.text.match(/https?:\S+/)[0]);
  await expect(
    page.getByRole("heading", { name: "Choose a username" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Contact support" }),
  ).toHaveAttribute(
    "href",
    "mailto:memorebo.dev@gmail.com?subject=Help%20with%20shelve.games",
  );
  await page.getByRole("button", { name: /Account menu/ }).click();
  await expect(
    page.getByRole("menuitem", { name: "Feedback", exact: true }),
  ).toHaveCount(0);
});

test("Feedback reflows and announces accessible states in both themes with reduced motion", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, `accessible${Date.now()}`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"] as const) {
    await page.goto("/");
    await chooseTheme(page, theme);
    await page
      .getByRole("button", { name: "Something confusing or missing?" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Send feedback" });
    await expect(dialog).toBeVisible();
    await page
      .getByLabel("Message", { exact: true })
      .fill("Long feedback. ".repeat(135));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 812 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const violations = (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations;
      expect(violations).toEqual([]);
      await snap(page, testInfo, `feedback-${theme}-${width}`);
    }
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByRole("status", { name: "Feedback status" }),
    ).toHaveText("Feedback sent.");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Something confusing or missing?" }),
    ).toBeFocused();
  }
});
