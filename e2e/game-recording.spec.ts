import { expect, test } from "@playwright/test";
import { chooseStatus } from "./support/journal";
import { signUp } from "./support/sign-up";

test.use({ video: "on", trace: "on" });
test.describe.configure({ timeout: 90_000 });

test("journal choices, tags, errors and removal preserve saved state", async ({
  page,
  request,
}) => {
  await signUp(page, request, `status_${Date.now()}`);
  await page.goto("/games/celeste");
  for (const status of [
    "wishlist",
    "backlog",
    "playing",
    "played",
    "completed",
    "played",
  ])
    await chooseStatus(page, status);
  await expect(
    page.getByRole("button", { name: "Journal status", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Journal status", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: "completed", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await chooseStatus(page, "No tag");
  await chooseStatus(page, "completed");
  await chooseStatus(page, "backlog");
  await chooseStatus(page, "played");
  await page
    .getByRole("button", { name: "Journal status", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: "No tag", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  const fail = (route: import("@playwright/test").Route) =>
    route.request().method() === "POST" ? route.abort() : route.continue();
  await page.route("**/games/celeste", fail);
  await page
    .getByRole("button", { name: "Journal status", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Game journal" }).getByRole("alert"),
  ).toContainText("Couldn’t");
  await page.unroute("**/games/celeste", fail);
  await chooseStatus(page, "wishlist");
  await page
    .getByRole("button", { name: "Journal status", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Remove from journal" }).click();
  await expect(
    page.getByRole("button", { name: "Journal status", exact: true }),
  ).toHaveAttribute("aria-description", "Not in your journal");
});

test("drawer drafts, validation, retry, outside-journal status, editing and deletion", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, `record_${Date.now()}`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    const samples: { type: string; value: number }[] = [];
    Object.assign(window, { recordingPerformance: samples });
    for (const type of ["longtask", "layout-shift"]) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          samples.push({
            type,
            value:
              type === "longtask"
                ? entry.duration
                : (entry as PerformanceEntry & { value: number }).value,
          });
      }).observe({ type, buffered: true });
    }
  });
  await page.goto("/games/celeste");
  await expect(
    page.getByText("No playthroughs yet.").filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Started", { exact: true })).toHaveCount(0);
  for (const name of ["Journal status", "Add playthrough"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
  });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("game-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Save adds this game/)).toBeVisible();
  await page.getByLabel("Started", { exact: true }).fill("2026-02-02");
  await page.getByLabel("Finished (optional)").fill("2026-01-01");
  await page.getByLabel("Notes (private, optional)").fill("A private draft");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("can't end before");
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.entries).toHaveLength(0);
  expect(exported.playthroughs).toHaveLength(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(page.getByLabel("Notes (private, optional)")).toHaveValue(
    "A private draft",
  );
  await page.getByLabel("Finished (optional)").fill("");
  await page
    .getByRole("combobox", { name: "Journal status", exact: true })
    .click();
  await page.getByRole("option", { name: "backlog", exact: true }).click();
  const fail = (route: import("@playwright/test").Route) =>
    route.request().method() === "POST" ? route.abort() : route.continue();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("drawer-desktop.png"),
  });
  await page.route("**/games/celeste", fail);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Couldn’t save");
  await expect(page.getByLabel("Notes (private, optional)")).toHaveValue(
    "A private draft",
  );
  await page.unroute("**/games/celeste", fail);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("drawer-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("drawer-mobile.png"),
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("drawer-mobile-dark.png"),
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("A private draft", { exact: true }),
  ).toBeVisible();
  const saved = await (await page.request.get("/api/account/export")).json();
  expect(saved.entries[0].status).toBe("backlog");
  expect(saved.playthroughs).toHaveLength(1);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Hours (optional)").fill("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/2 h/)).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Delete playthrough" }).click();
  await expect(
    page.getByText("No playthroughs yet.").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toBeFocused();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await testInfo.attach("production-performance-4x-cpu", {
    body: JSON.stringify(
      {
        metrics: await cdp.send("Performance.getMetrics"),
        entries: await page.evaluate(
          () =>
            (window as unknown as { recordingPerformance: unknown })
              .recordingPerformance,
        ),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("signed-out actions lead to sign in and no-platform games explain the limitation", async ({
  page,
  request,
}) => {
  await page.goto("/games/celeste");
  await page
    .getByRole("link", { name: "Add playthrough", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await signUp(page, request, `platformless_${Date.now()}`);
  await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: "insert into game (id, title, slug, genres, platforms, synced_at) values (8888, 'No platforms', 'no-platforms', '{}', '{}', now()) on conflict do nothing",
      params: [],
    },
  });
  await page.goto("/games/no-platforms");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(page.getByText(/no platforms listed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
});

test("delayed personal content reveals one compact action area without opening an editor", async ({
  page,
  request,
}) => {
  const email = await signUp(page, request, `delayed_record_${Date.now()}`);
  await page.goto("/games/celeste");
  await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `insert into journal_entry (user_id, game_id, status) select id, 1, 'played' from "user" where email = $1`,
      params: [email],
    },
  });
  await request.post("http://127.0.0.1:3101/query", {
    data: {
      sql: `insert into playthrough (user_id, game_id, platform, started_on, notes) select u.id, 1, 'PC', '2026-01-01', 'Delayed history ' || n from "user" u cross join generate_series(1, 5) n where email = $1`,
      params: [email],
    },
  });
  await request.post("http://127.0.0.1:3101/collection-delay", {
    data: { email, milliseconds: 2000 },
  });
  await page.goto("/games/celeste", { waitUntil: "commit" });
  await expect(
    page.getByRole("heading", { name: "Celeste", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading journal" }),
  ).toBeVisible();
  const scores = page
    .getByText("Critic score", { exact: true })
    .filter({ visible: true });
  const before = await scores.boundingBox();
  await expect(
    page.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toBeVisible();
  expect(
    Math.abs(((await scores.boundingBox())?.y ?? 0) - (before?.y ?? 0)),
  ).toBeLessThan(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Started", { exact: true })).toHaveCount(0);
  await request.post("http://127.0.0.1:3101/collection-delay", {
    data: { email, milliseconds: 0 },
  });
});

test("cancel never writes and the drawer stays within a keyboard-reduced visual viewport", async ({
  page,
  request,
}) => {
  await signUp(page, request, `keyboard_record_${Date.now()}`);
  await page.goto("/games/celeste");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-01");
  await page.keyboard.press("Shift+Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await page.evaluate(() => {
    if (!visualViewport) throw new Error("Visual viewport unavailable");
    Object.defineProperty(visualViewport, "height", {
      configurable: true,
      value: 400,
    });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(async () => {
      const save = await page
        .getByRole("button", { name: "Save", exact: true })
        .boundingBox();
      return (save?.y ?? 9999) + (save?.height ?? 0);
    })
    .toBeLessThanOrEqual(400);
  await page.evaluate(() => {
    if (visualViewport) {
      Reflect.deleteProperty(visualViewport, "height");
      visualViewport.dispatchEvent(new Event("resize"));
    }
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.entries).toHaveLength(0);
  expect(exported.playthroughs).toHaveLength(0);
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(page.getByLabel("Started", { exact: true })).toHaveValue("");
});
