import { expect, type Locator, type Page, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";
import { snap } from "./support/snap";

/** Every visible target is at least 44 × 44 CSS px and none overlap. */
async function expectTouchTargets(targets: Locator) {
  const boxes = [];
  for (const target of await targets.all()) {
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    if (!box) continue;
    const name =
      (await target.getAttribute("aria-label")) ?? (await target.innerText());
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
    boxes.push({ name, ...box });
  }
  expect(boxes.length).toBeGreaterThan(0);
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      expect(
        a.x + a.width <= b.x + 0.5 ||
          b.x + b.width <= a.x + 0.5 ||
          a.y + a.height <= b.y + 0.5 ||
          b.y + b.height <= a.y + 0.5,
        `${a.name} overlaps ${b.name}`,
      ).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test("populated collections keep Find a game reachable with comfortable phone controls", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const signedOut = await browser.newPage({
    viewport: { width: 320, height: 640 },
  });
  await signedOut.goto("/");
  await expectNoHorizontalOverflow(signedOut);
  await expectTouchTargets(signedOut.locator("header a, header button"));
  await snap(signedOut, testInfo, "signed-out-320");
  await signedOut.close();

  const username = `nav_${Date.now()}`;
  await signUp(page, request, username);

  // Released Celeste on the wishlist offers moves; upcoming Silksong counts down.
  for (const title of ["Celeste", "Silksong"]) {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search games" }).fill(title);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await chooseStatus(page, "wishlist");
  }

  const nav = page.getByRole("navigation", { name: "Main" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/library");
    await expect(page.getByRole("list", { name: "Games" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Library" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(
      page.locator(
        "header a, header button, main select, main fieldset button",
      ),
    );
    // Account actions sit on their own row, above the collection navigation.
    const signOut = page.getByRole("button", { name: "Sign out" });
    const navBox = await nav.boundingBox();
    const signOutBox = await signOut.boundingBox();
    if (!navBox || !signOutBox) throw new Error("Header has no bounds");
    expect(signOutBox.y + signOutBox.height).toBeLessThanOrEqual(navBox.y);
  }
  await snap(page, testInfo, "library-mobile");

  await page.goto("/wishlist");
  await expect(nav.getByRole("link", { name: "Wishlist" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: /^Move Celeste/ })).toHaveCount(
    2,
  );
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(
    page.locator("header a, header button, main li button"),
  );
  await snap(page, testInfo, "wishlist-mobile");

  // Keyboard: the brand is the first stop and carries a visible focus ring.
  await page.keyboard.press("Tab");
  const brand = page.getByRole("link", { name: "shelve.games" });
  await expect(brand).toBeFocused();
  await expect(brand).not.toHaveCSS("box-shadow", "none");

  await nav.getByRole("link", { name: "Find a game" }).click();
  await expect(page).toHaveURL("/");
  await expect(nav.getByRole("link", { name: "Find a game" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("searchbox", { name: "Search games" }).fill("Celeste");
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("link", { name: /Celeste/ })
    .click();
  await expect(page).toHaveURL(/\/games\/celeste/);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  await brand.click();
  await expect(page).toHaveURL("/");

  for (const [name, width, height] of [
    ["library-tablet", 768, 1024],
    ["library-desktop", 1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/library");
    await expect(page.getByRole("list", { name: "Games" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await snap(page, testInfo, name);
  }
});
