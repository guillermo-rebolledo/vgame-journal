import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { chooseTheme } from "./support/header";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";

async function renderedContrast(element: Locator) {
  // Hide only ink: the screenshot retains painted images, gradients, and surfaces.
  const background = await element.screenshot({
    animations: "disabled",
    scale: "css",
    style:
      "* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; } svg { opacity: 0 !important; }",
  });
  return element.evaluate(async (node, png) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.fillStyle = getComputedStyle(node).color;
    context.fillRect(0, 0, 1, 1);
    const foreground = [...context.getImageData(0, 0, 1, 1).data];
    let opacity = foreground[3] / 255;
    for (
      let parent: Element | null = node;
      parent;
      parent = parent.parentElement
    )
      opacity *= Number(getComputedStyle(parent).opacity);
    const image = await createImageBitmap(
      new Blob([Uint8Array.from(atob(png), (char) => char.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
    image.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    function luminance(rgb: number[]) {
      return rgb.reduce((sum, channel, index) => {
        const value = channel / 255;
        return (
          sum +
          (value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][index]
        );
      }, 0);
    }
    let minimum = Infinity;
    let worstBackground: number[] = [];
    // Inset past rounded corners and borders; sample the whole area behind ink.
    for (let y = 4; y < canvas.height - 4; y++) {
      for (let x = 4; x < canvas.width - 4; x++) {
        const offset = (y * canvas.width + x) * 4;
        const background = [...pixels.slice(offset, offset + 3)];
        const ink = background.map(
          (channel, index) =>
            foreground[index] * opacity + channel * (1 - opacity),
        );
        const a = luminance(ink);
        const b = luminance(background);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < minimum) {
          minimum = ratio;
          worstBackground = background;
        }
      }
    }
    return { foreground, opacity, background: worstBackground, ratio: minimum };
  }, background.toString("base64"));
}

async function scan(page: Page, testInfo: TestInfo, name: string) {
  await expect(
    page
      .getByRole("main")
      .getByText(
        /^(Loading .*|Opening your Journal|Checking Journal status)…$/,
      ),
  ).toHaveCount(0);
  // Metadata can stream after a save refresh has restored the page controls.
  await expect(page).toHaveTitle(/\S/);
  // Scan the settled menu, rather than intermediate fade-in text colors.
  const menu = page.getByRole("menu");
  if (await menu.count()) await expect(menu).toHaveCSS("opacity", "1");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  await testInfo.attach(name, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  const blocking = results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
  expect
    .soft(blocking, `${name}: serious or critical WCAG violations`)
    .toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility in ${theme} theme`, () => {
    test.setTimeout(120_000);

    test("settled Hades text and meaningful controls retain rendered contrast", async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/games/hades--1");
      await chooseTheme(page, theme);
      const main = page.getByRole("main");
      const genre = main.locator("article header p");
      await expect(genre).toContainText("Role-playing (RPG)");
      await expect(
        main.getByRole("button", { name: "Add to list", exact: true }),
      ).toBeVisible();
      const cover = main.locator("article header img");
      await expect
        .poll(() =>
          cover.evaluate(
            (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
          ),
        )
        .toBe(true);
      await scan(page, testInfo, "settled-hades");
      const measurements = [];
      const add = main.getByRole("link", {
        name: "Add playthrough",
        exact: true,
      });
      for (const [name, element, threshold] of [
        ["genre", genre, 4.5],
        ["large title", main.getByRole("heading", { level: 1 }), 3],
        ["action label", add, 4.5],
        ["action icon", add.locator("svg"), 3],
      ] as const) {
        const measured = await renderedContrast(element);
        measurements.push({ name, threshold, ...measured });
        expect.soft(measured.ratio, name).toBeGreaterThanOrEqual(threshold);
      }
      await add.hover();
      await add.focus();
      await expect(add).toBeFocused();
      const focused = await renderedContrast(add);
      measurements.push({
        name: "hovered and focused action",
        threshold: 4.5,
        ...focused,
      });
      expect.soft(focused.ratio).toBeGreaterThanOrEqual(4.5);
      await testInfo.attach("hades-rendered-contrast", {
        body: JSON.stringify(measurements, null, 2),
        contentType: "application/json",
      });
    });

    test("lists and list creation drawer", async ({
      page,
      request,
    }, testInfo) => {
      await signUp(page, request, `axe_lists_${theme}_${Date.now()}`);
      await chooseTheme(page, theme);
      await page.goto("/lists");
      await expect(
        page
          .getByText("No lists yet", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await scan(page, testInfo, "empty-lists");
      await page
        .getByRole("button", { name: "Create a list", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Create a list", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "list-creation-drawer");
      await page
        .getByRole("textbox", { name: "List title", exact: true })
        .fill("   ");
      await page
        .getByRole("button", { name: "Create list", exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: "List title", exact: true }),
      ).toHaveAttribute("aria-invalid", "true");
      await scan(page, testInfo, "list-title-validation");
      await page
        .getByRole("textbox", { name: "List title", exact: true })
        .fill("Weekend games");
      await page
        .getByRole("button", { name: "Create list", exact: true })
        .click();
      await expect(page).toHaveURL(/\/lists\/[a-f0-9-]+$/);
      await page.goto("/lists");
      await expect(
        page.getByRole("link", { name: "Weekend games", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "populated-lists");
    });

    test("guest pages and search results", async ({ page }, testInfo) => {
      await page.goto("/");
      await chooseTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await scan(page, testInfo, "guest-home");

      await page.getByRole("searchbox").fill("Celeste");
      await expect(
        page.getByRole("link", { name: "Celeste", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "search-results");

      for (const path of [
        "/games/celeste",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await scan(page, testInfo, path);
      }
    });

    test("personal pages, journal menu, and playthrough editor", async ({
      page,
      request,
    }, testInfo) => {
      const username = `axe_${theme}_${Date.now()}`;
      await signUp(page, request, username);
      await chooseTheme(page, theme);
      await page.goto("/games/celeste");
      await expect(
        page.getByRole("button", { name: "Add playthrough", exact: true }),
      ).toBeVisible();
      await scan(page, testInfo, "unsaved-game");
      await chooseStatus(page, "playing");
      await page
        .getByRole("button", { name: /Change Journal status for/ })
        .click();
      await expect(page.getByRole("menu")).toBeVisible();
      await scan(page, testInfo, "journal-menu");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu", { includeHidden: true })).toHaveCount(
        0,
      );

      const add = page.getByRole("button", {
        name: "Add playthrough",
        exact: true,
      });
      await add.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan(page, testInfo, "playthrough-editor");
      await page.getByLabel("Started", { exact: true }).fill("2026-02-02");
      await page.getByLabel("Finished (optional)").fill("2026-01-01");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
      await scan(page, testInfo, "playthrough-validation");
      await page.getByLabel("Finished (optional)").fill("");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(add).toBeFocused();
      await scan(page, testInfo, "saved-playthrough");

      await page.goto("/games/hades--1");
      await chooseStatus(page, "wishlist");
      for (const path of [
        "/",
        "/library",
        "/wishlist",
        "/stats",
        "/settings",
        `/u/${username}`,
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await scan(page, testInfo, path);
      }
    });
  });
}
