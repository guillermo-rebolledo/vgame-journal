import { expect, type Page, test } from "@playwright/test";
import { expectContainedScroll } from "./support/contained-scroll";
import { chooseTheme } from "./support/header";
import { signUp } from "./support/sign-up";

const ageRating = (page: Page) =>
  page.getByRole("button", { name: /^Age rating: / });
const languages = (page: Page) =>
  page.getByRole("button", { name: /^Languages: / });

test("a rated game shows its guest board, with details on hover, focus and Escape", async ({
  page,
}) => {
  await page.goto("/games/hades--1");
  await expect(ageRating(page)).toHaveAccessibleName(
    "Age rating: Teen · ESRB View details",
  );
  await expect(ageRating(page).getByRole("img")).toHaveAccessibleName("ESRB T");
  await expect(ageRating(page)).toContainText("Teen · ESRB");

  await ageRating(page).hover();
  await expect(ageRating(page)).toHaveAttribute("aria-expanded", "true");
  const rating = page.locator(
    `[id="${await ageRating(page).getAttribute("aria-controls")}"]`,
  );
  await expect(rating).toContainText("ESRB · North America");
  for (const chip of ["Blood", "Fantasy Violence", "Language"])
    await expect(rating.getByText(chip, { exact: true })).toBeVisible();
  await expect(rating.getByText("Other regions")).toBeVisible();
  await expect(rating.getByRole("img")).toHaveCount(7);
  for (const logo of [
    "PEGI 12",
    "CERO C",
    "USK 12",
    "ACB M",
    "GRAC 15+",
    "ClassInd 14",
  ])
    await expect(rating.getByRole("img", { name: logo })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rating).toHaveCount(0);
  await expect(ageRating(page)).toHaveAttribute("aria-expanded", "false");

  await page.mouse.move(0, 0);
  await languages(page).focus();
  await expect(languages(page)).toHaveAccessibleName(
    "Languages: 3 English voices View details",
  );
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(page.getByText("3 languages · English voices")).toBeVisible();
  const rows = table.getByRole("row");
  await expect(rows.nth(1)).toContainText("English");
  await expect(rows.nth(1).getByRole("img", { name: "Yes" })).toHaveCount(3);
  await expect(rows.nth(2)).toContainText("French");
  await expect(rows.nth(2).getByRole("img", { name: "No" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(table).toHaveCount(0);
});

test("an unrated game without languages says so, with no details", async ({
  page,
}) => {
  await page.goto("/games/dead-cells");
  const facts = page.getByRole("definition");
  await expect(facts.getByText("Not rated yet")).toBeVisible();
  await expect(facts.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(ageRating(page)).toHaveCount(0);
  await expect(languages(page)).toHaveCount(0);
});

test("a game the guest board hasn't rated falls back, and many languages scroll", async ({
  page,
}) => {
  await page.goto("/games/slay-the-spire");
  await expect(ageRating(page)).toHaveAccessibleName(
    "Age rating: Ages 7+ · PEGI View details",
  );
  await expect(languages(page)).toHaveAccessibleName(
    "Languages: 28 English voices View details",
  );
  await languages(page).hover();
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(29);
  const scroller = table.locator("..");
  await expect(table.locator("../..")).toHaveCSS("opacity", "1");
  await expect(table.locator("../..")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await expectContainedScroll(page, scroller);
});

test("structured data carries the guest rating and languages", async ({
  page,
}) => {
  await page.goto("/games/hades--1");
  const data = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()) ?? "{}",
  );
  expect(data.contentRating).toBe("ESRB T");
  expect(data.inLanguage).toEqual(["English", "French", "Japanese"]);
});

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("a tap opens the details and a tap outside closes them", async ({
    page,
  }) => {
    await page.goto("/games/hades--1");
    await ageRating(page).tap();
    await expect(ageRating(page)).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Other regions")).toBeVisible();
    await ageRating(page).tap();
    await expect(ageRating(page)).toHaveAttribute("aria-expanded", "false");
    await ageRating(page).tap();
    await expect(page.getByText("Other regions")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(page.getByText("Other regions")).toHaveCount(0);
    await languages(page).tap();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(page.getByRole("table")).toHaveCount(0);
    // Hybrid devices can switch back to a mouse after using touch.
    await ageRating(page).hover();
    await expect(page.getByText("Other regions")).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.getByText("Other regions")).toHaveCount(0);
  });
});

test("the headline board follows the signed-in user's Region", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await signUp(page, request, `ratings_${Date.now()}`);
  await page.goto("/games/hades--1");
  await expect(ageRating(page)).toHaveAccessibleName(
    "Age rating: Teen · ESRB View details",
  );

  await page.goto("/settings");
  await page.getByRole("radio", { name: /Europe European/ }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.goto("/games/hades--1");
  await expect(ageRating(page)).toHaveAccessibleName(
    "Age rating: Ages 12+ · PEGI View details",
  );
  await expect(ageRating(page).getByRole("img")).toHaveAccessibleName(
    "PEGI 12",
  );
});

test("unavailable facts are explicit metadata without score placeholders or disclosures", async ({
  page,
}) => {
  await page.goto("/games/dead-cells");
  const facts = page.locator("dl");
  await expect(facts.getByRole("term")).toHaveText([
    "Scores",
    "Age rating",
    "Languages",
  ]);
  await expect(facts.getByRole("definition")).toHaveText([
    "Scores unavailable",
    "Not rated yet",
    "Unknown",
  ]);
  await expect(facts.getByRole("button")).toHaveCount(0);
  await expect(facts.getByText("View details")).toHaveCount(0);
  await expect(facts.getByText("–", { exact: true })).toHaveCount(0);
});

test("fact cues remain visible and keyboard activation reopens dismissed details", async ({
  page,
}) => {
  await page.goto("/games/hades--1");
  for (const trigger of [ageRating(page), languages(page)]) {
    await expect(trigger.getByText("View details")).toBeVisible();
    await trigger.focus();
    await trigger.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    for (const key of ["Enter", "Space"]) {
      await trigger.press(key);
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
    }
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("heading", { level: 1 }).click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`full and partial scores preserve known values and counts in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/games/hades--1");
    await chooseTheme(page, theme);
    const facts = page
      .locator('dl[aria-label="Game facts"]')
      .filter({ visible: true });
    await expect(facts.getByRole("term")).toHaveText([
      "Critic score",
      "User score",
      "Age rating",
      "Languages",
    ]);
    await expect(facts.getByText("95", { exact: true })).toBeVisible();
    await expect(facts.getByText("1,234 reviews")).toBeVisible();
    await expect(facts.getByText("91", { exact: true })).toBeVisible();
    await expect(facts.getByText("5,678 ratings")).toBeVisible();
    await expect(facts.getByText("View details")).toHaveCount(2);
    await expect(facts.getByText(/unavailable/i)).toHaveCount(0);

    for (const fixture of [
      {
        slug: "critic-score-fixture",
        missing: "User score",
        score: "95",
        count: "1,234 reviews",
      },
      {
        slug: "user-score-fixture",
        missing: "Critic score",
        score: "0",
        count: "1 rating",
      },
    ]) {
      await page.goto(`/games/${fixture.slug}`);
      await expect(
        facts.getByText(fixture.missing, { exact: true }),
      ).toBeVisible();
      await expect(
        facts.getByText("Unavailable", { exact: true }),
      ).toBeVisible();
      await expect(
        facts.getByText(fixture.score, { exact: true }),
      ).toBeVisible();
      await expect(
        facts.getByText(fixture.count, { exact: true }),
      ).toBeVisible();
      await expect(facts.getByText("Scores unavailable")).toHaveCount(0);
      await expect(facts.getByText("–", { exact: true })).toHaveCount(0);
      await expect(facts.getByRole("button")).toHaveCount(0);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`facts reflow with enlarged text and retain useful details in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.goto("/games/hades--1");
    await chooseTheme(page, theme);
    const facts = page
      .locator('dl[aria-label="Game facts"]')
      .filter({ visible: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const fontSize of ["100%", "200%"]) {
        await page.evaluate((fontSize) => {
          document.documentElement.style.fontSize = fontSize;
        }, fontSize);
        await facts.scrollIntoViewIfNeeded();
        for (const trigger of [ageRating(page), languages(page)]) {
          await expect(trigger.getByText("View details")).toBeVisible();
          expect(
            await trigger.evaluate((el) => el.scrollWidth <= el.clientWidth),
            `${width}px / ${fontSize}: fact contents fit`,
          ).toBe(true);
        }
        expect(
          await facts.evaluate(
            (el) =>
              el.scrollWidth <= el.clientWidth &&
              el.getBoundingClientRect().right <= innerWidth,
          ),
          `${width}px / ${fontSize}: facts stay within the viewport`,
        ).toBe(true);
        for (const trigger of [ageRating(page), languages(page)]) {
          await trigger.press("Enter");
          await expect(trigger).toHaveAttribute("aria-expanded", "true");
          const popup = page.locator(
            `[id="${await trigger.getAttribute("aria-controls")}"]`,
          );
          await expect(popup).toBeVisible();
          expect(
            await popup.evaluate((el) => {
              const rect = el.getBoundingClientRect();
              return (
                rect.left >= 0 &&
                rect.right <= innerWidth &&
                el.scrollWidth <= el.clientWidth
              );
            }),
            `${width}px / ${fontSize}: fact details fit`,
          ).toBe(true);
          await page.keyboard.press("Escape");
        }
      }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "100%";
      });
      if (width === 320 || width === 1440) {
        await testInfo.attach(`facts-${theme}-${width}`, {
          body: await facts.screenshot(),
          contentType: "image/png",
        });
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await languages(page).press("Enter");
    await expect(page.getByRole("table")).toBeVisible();
    await page.keyboard.press("Escape");
    for (const slug of [
      "dead-cells",
      "the-lantern-keeper-s-extraordinarily-long-voyage-across-the-shattered-archipelago-definitive-edition",
    ]) {
      await page.goto(`/games/${slug}`);
      await page.setViewportSize({ width: 320, height: 1000 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await expect(facts.getByRole("definition")).toHaveText([
        "Scores unavailable",
        "Not rated yet",
        "Unknown",
      ]);
      expect(
        await facts.evaluate(
          (el) =>
            el.scrollWidth <= el.clientWidth &&
            el.getBoundingClientRect().right <= innerWidth,
        ),
      ).toBe(true);
      await expect(facts.getByRole("button")).toHaveCount(0);
      await testInfo.attach(`sparse-facts-${theme}-${slug}`, {
        body: await facts.screenshot(),
        contentType: "image/png",
      });
    }
  });
}
