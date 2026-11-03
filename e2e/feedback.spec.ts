import { expect, test } from "@playwright/test";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";
import { supportUrl } from "./support/url";

test("feedback stores real submissions, collapses on mobile, and limits the sixth message", async ({
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
  const trigger = page.getByRole("button", { name: "Send feedback" });
  await expect(trigger.getByText("Feedback")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(trigger).toBeVisible();
  await expect(trigger.getByText("Feedback")).toBeHidden();
  const account = page.getByRole("button", {
    name: `Account menu, @${username}`,
  });
  const feedbackBox = await trigger.boundingBox();
  const accountBox = await account.boundingBox();
  if (!feedbackBox || !accountBox) throw new Error("Header controls missing");
  expect(feedbackBox.y).toBe(accountBox.y);
  expect(feedbackBox.x + feedbackBox.width).toBeLessThanOrEqual(accountBox.x);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await snap(page, testInfo, "feedback-mobile-header");
  for (let i = 0; i < 6; i++) {
    await trigger.click();
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
