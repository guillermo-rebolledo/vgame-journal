import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { chooseTheme } from "./support/header";
import { seedSql } from "./support/seed-sql";
import { signUp, uniqueUsername } from "./support/sign-up";
import { snap } from "./support/snap";

test("list cards and creation drawer reflow in both themes with reduced motion", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, request, uniqueUsername("lists_visual"));
  const { user } = await (
    await page.request.get("/api/auth/get-session")
  ).json();
  await seedSql(
    request,
    [
      `insert into game (id,title,slug,cover_image_id,genres,platforms,synced_at) values
      (80000,'Hades','hades--1','cob9kr','{}','{}',now()),
      (80001,'Dead Cells','dead-cells','co7jfv','{}','{}',now()),
      (80002,'Slay the Spire','slay-the-spire','co1iyf','{}','{}',now()),
      (80003,'Hollow Knight','hollow-knight','co1rgi','{}','{}',now()) on conflict do nothing`,
    ],
    [],
  );
  const titles = [
    "Weekend games",
    "Favorites to replay",
    "Games to play with friends",
    "A very long list title for checking wrapping and card alignment across different screen widths",
  ];
  for (const [index, title] of titles.entries()) {
    const id = randomUUID();
    await seedSql(
      request,
      [
        "insert into custom_list (id,user_id,title,visibility,submission_id,updated_at) values ($1,$2,$3,$4,$5,$6::timestamp)",
      ],
      [
        id,
        user.id,
        title,
        index % 2 ? "public" : "private",
        randomUUID(),
        new Date(Date.UTC(2026, 10, 3 - index, 18)).toISOString(),
      ],
    );
    if (index !== 2)
      await seedSql(
        request,
        [
          "insert into list_entry (list_id,game_id,position) select $1::uuid,80000+n,n from generate_series(0,3) n",
        ],
        [id],
      );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lists");
  const create = page.getByRole("button", {
    name: "Create a list",
    exact: true,
  });
  await expect(
    page.getByRole("link", { name: titles[0], exact: true }),
  ).toBeVisible();
  for (const theme of ["dark", "light"] as const) {
    await chooseTheme(page, theme);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole("heading", { name: "Lists", exact: true }).click();
      await page.mouse.move(0, 0);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      if (width === 1440 || width === 320)
        await snap(page, testInfo, `lists-${theme}-${width}`, true);
      await create.click();
      const dialog = page.getByRole("dialog", {
        name: "Create a list",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect
        .poll(() =>
          dialog.evaluate((node) => {
            const bounds = node.getBoundingClientRect();
            return (
              Math.round(bounds.left) === 0 &&
              Math.round(bounds.width) === window.innerWidth &&
              Math.round(bounds.bottom) === window.innerHeight
            );
          }),
        )
        .toBe(true);
      await expect
        .poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth))
        .toBe(true);
      if (width === 1440 || width === 320)
        await snap(page, testInfo, `drawer-${theme}-${width}`);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(create).toBeFocused();
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await create.click();
  const drawer = page.getByRole("dialog", {
    name: "Create a list",
    exact: true,
  });
  await expect
    .poll(() => drawer.evaluate((el) => el.scrollWidth <= el.clientWidth))
    .toBe(true);
  await page.evaluate(() => {
    if (!visualViewport) throw new Error("Visual viewport unavailable");
    Object.defineProperty(visualViewport, "height", {
      configurable: true,
      value: 400,
    });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  const submit = drawer.getByRole("button", {
    name: "Create list",
    exact: true,
  });
  await submit.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => {
      const box = await submit.boundingBox();
      return (box?.y ?? 9999) + (box?.height ?? 0);
    })
    .toBeLessThanOrEqual(400);
  await page.evaluate(() => {
    document.documentElement.style.removeProperty("font-size");
    if (visualViewport) {
      Reflect.deleteProperty(visualViewport, "height");
      visualViewport.dispatchEvent(new Event("resize"));
    }
  });
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await page.getByRole("link", { name: titles[0], exact: true }).press("Enter");
  await expect(
    page.getByRole("heading", { name: titles[0], exact: true }),
  ).toBeVisible();
});
