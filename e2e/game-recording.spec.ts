import { expect, type Locator, test } from "@playwright/test";
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
  await expect(page).toHaveURL("/sign-in?returnTo=%2Fgames%2Fceleste");
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
  await page
    .getByRole("button", { name: "Save", exact: true })
    .scrollIntoViewIfNeeded();
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

test("F01: cancelling or dismissing Journal removal preserves saved Playthroughs and private notes", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, `removal_${Date.now()}`);
  await page.goto("/games/celeste");
  await chooseStatus(page, "played");
  await chooseStatus(page, "completed");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-01-02");
  await page
    .getByLabel("Notes (private, optional)")
    .fill("Summit route — keep this private note 🎮");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const before = await (await page.request.get("/api/account/export")).json();
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/games/celeste"))
      writes++;
  });
  const trigger = page.getByRole("button", {
    name: "Journal status",
    exact: true,
  });
  const dialog = page.getByRole("dialog", {
    name: "Remove Celeste from journal?",
  });
  for (const dismiss of ["Cancel", "Escape", "outside"]) {
    await trigger.click();
    await page.getByRole("menuitem", { name: "Remove from journal" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("1 Playthrough");
    await expect(dialog).toContainText(
      "all current Playthroughs and private notes will be permanently deleted",
    );
    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    expect(writes).toBe(0);
    if (dismiss === "Cancel") {
      await page.screenshot({
        path: testInfo.outputPath("removal-confirmation-desktop.png"),
      });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    } else if (dismiss === "Escape") await page.keyboard.press("Escape");
    else await page.mouse.click(8, 8);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.reload();
    await expect(
      page
        .getByRole("region", { name: "Playthroughs", exact: true })
        .getByText("Summit route — keep this private note 🎮", {
          exact: true,
        }),
    ).toBeVisible();
    expect(
      await (await page.request.get("/api/account/export")).json(),
    ).toEqual(before);
  }
});

test("F01: confirmed removal waits for acknowledgement, recovers locally, and permanently deletes saved data", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, `remove_retry_${Date.now()}`);
  await page.goto("/games/celeste");
  await chooseStatus(page, "played");
  await chooseStatus(page, "completed");
  for (const note of [
    "First private summit note",
    "Second private summit note",
  ]) {
    await page
      .getByRole("button", { name: "Add playthrough", exact: true })
      .click();
    await page.getByLabel("Started", { exact: true }).fill("2026-01-02");
    await page.getByLabel("Notes (private, optional)").fill(note);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const before = await (await page.request.get("/api/account/export")).json();
  await page
    .getByRole("button", { name: "Journal status", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Remove from journal" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Remove Celeste from journal?",
  });
  await expect(dialog).toContainText("2 Playthroughs");
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  const fail = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "POST") return route.continue();
    submissions++;
    await held;
    await route.abort();
  };
  await page.route("**/games/celeste", fail);
  try {
    await dialog
      .getByRole("button", { name: "Remove permanently", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Removing…", exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect.poll(() => submissions).toBe(1);
    await expect(
      page.getByText("Celeste removed from your journal.", { exact: true }),
    ).toHaveCount(0);
    expect(
      await (await page.request.get("/api/account/export")).json(),
    ).toEqual(before);
  } finally {
    release();
  }
  await expect(dialog.getByRole("alert")).toContainText("Couldn’t");
  await page.unroute("**/games/celeste", fail);
  const retry = dialog.getByRole("button", {
    name: "Retry removal",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  // Reload another tab without discarding this tab's local recovery state.
  const check = await page.context().newPage();
  await check.goto("/games/celeste");
  await expect(
    check.getByRole("region", { name: "Playthroughs", exact: true }),
  ).toContainText("First private summit note");
  expect(await (await check.request.get("/api/account/export")).json()).toEqual(
    before,
  );
  await check.close();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }, theme);
    await retry.scrollIntoViewIfNeeded();
    await expect(retry).toBeInViewport();
    const box = await dialog.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 9999)).toBeLessThanOrEqual(320);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`removal-retry-phone-large-text-${theme}.png`),
    });
  }
  await retry.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Celeste removed from your journal.",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Journal status", exact: true }),
  ).toHaveAttribute("aria-description", "Not in your journal");
  const removed = await (await page.request.get("/api/account/export")).json();
  expect(removed.entries).toEqual([]);
  expect(removed.playthroughs).toEqual([]);
  expect(removed.statusHistory).toEqual([
    ...before.statusHistory,
    expect.objectContaining({ gameId: 1, status: null, completionTag: null }),
  ]);
  await chooseStatus(page, "playing");
  await page.reload();
  await expect(
    page.getByText("No playthroughs yet.").filter({ visible: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/account/export")).json()).playthroughs,
  ).toEqual([]);
});

test.describe("F01: stale Journal removal on a touch screen", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: "reduce",
  });

  test("a stale zero-Playthrough tab requires confirmation and acknowledgement covers all current Playthroughs", async ({
    page,
    request,
  }) => {
    await signUp(page, request, `remove_stale_${Date.now()}`);
    await page.goto("/games/celeste");
    await chooseStatus(page, "playing");
    await expect(
      page.getByText("No playthroughs yet.").filter({ visible: true }),
    ).toBeVisible();
    const other = await page.context().newPage();
    await other.goto("/games/celeste");
    async function addInOtherTab(note: string) {
      await other
        .getByRole("button", { name: "Add playthrough", exact: true })
        .tap();
      await other.getByLabel("Started", { exact: true }).fill("2026-01-02");
      await other.getByLabel("Notes (private, optional)").fill(note);
      await other.getByRole("button", { name: "Save", exact: true }).tap();
      await expect(other.getByRole("dialog")).toHaveCount(0);
    }
    await addInOtherTab("Private note added in the other tab");
    const before = await (await page.request.get("/api/account/export")).json();
    const trigger = page.getByRole("button", {
      name: "Journal status",
      exact: true,
    });
    await trigger.tap();
    await page.getByRole("menuitem", { name: "Remove from journal" }).tap();
    const dialog = page.getByRole("dialog", {
      name: "Remove Celeste from journal?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("1 Playthrough");
    expect(
      await (await page.request.get("/api/account/export")).json(),
    ).toEqual(before);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).tap();
    await expect(trigger).toBeFocused();
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Playthroughs", exact: true }),
    ).toContainText("Private note added in the other tab");
    await trigger.tap();
    await page.getByRole("menuitem", { name: "Remove from journal" }).tap();
    await expect(dialog).toContainText(
      "all current Playthroughs and private notes",
    );
    await addInOtherTab("Another private note added after confirmation opened");
    await dialog
      .getByRole("button", { name: "Remove permanently", exact: true })
      .tap();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "Celeste removed from your journal.",
    );
    await other.reload();
    await expect(
      other.getByRole("button", { name: "Journal status", exact: true }),
    ).toHaveAttribute("aria-description", "Not in your journal");
    const removed = await (
      await page.request.get("/api/account/export")
    ).json();
    expect(removed.entries).toEqual([]);
    expect(removed.playthroughs).toEqual([]);
    expect(removed.statusHistory).toEqual([
      ...before.statusHistory,
      expect.objectContaining({ gameId: 1, status: null }),
    ]);
    await other.close();
  });
});

test.describe("enlarged-text touch editor", () => {
  test.use({ hasTouch: true });
  for (const theme of ["light", "dark"] as const) {
    test(`F02: enlarged-text long-title editor can save and edit in ${theme}`, async ({
      page,
      request,
    }, testInfo) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await signUp(
        page,
        request,
        `reflow_${theme}_${testInfo.workerIndex}_${Date.now()}`,
      );
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(
        "/games/the-lantern-keeper-s-extraordinarily-long-voyage-across-the-shattered-archipelago-definitive-edition",
      );
      if (theme === "light")
        await page.getByRole("button", { name: "Toggle theme" }).click();
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "32px";
      });
      const add = page.getByRole("button", {
        name: "Add playthrough",
        exact: true,
      });
      await add.tap();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveAccessibleDescription(
        "The Lantern Keeper's Extraordinarily Long Voyage Across the Shattered Archipelago: Definitive Edition",
      );
      const started = page.getByLabel("Started", { exact: true });
      const cdp = await page.context().newCDPSession(page);
      // Send touch input directly instead of relying on the platform gesture
      // generator that reported completion without scrolling in Linux CI.
      async function swipe(
        distance: number,
        origin?: { x: number; y: number },
      ) {
        const bounds = await dialog.boundingBox();
        if (!bounds) throw new Error("Editor has no bounds");
        const x = origin?.x ?? bounds.x + 16;
        const y =
          origin?.y ??
          (distance > 0 ? bounds.y + bounds.height - 24 : bounds.y + 88);
        await expect
          .poll(() =>
            page.evaluate(
              ({ x, y }) => {
                const hit = document.elementFromPoint(x, y);
                return !!hit?.closest('[role="dialog"]');
              },
              { x, y },
            ),
          )
          .toBe(true);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        try {
          for (let step = 1; step <= 12; step++) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x, y: y - (distance * step) / 12 }],
            });
            await page.evaluate(
              () =>
                new Promise<void>((resolve) => {
                  requestAnimationFrame(() => resolve());
                }),
            );
          }
        } finally {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        }
      }
      async function touchReveal(target: Locator) {
        for (let attempt = 0; attempt < 30; attempt++) {
          const bounds = await dialog.boundingBox();
          const field = await target.boundingBox();
          if (!bounds || !field)
            throw new Error("Editor control has no bounds");
          const top = bounds.y + 80; // Keep the gesture and control below the handle.
          const bottom = bounds.y + bounds.height - 8;
          if (field.y >= top && field.y + field.height <= bottom) {
            expect(field.x, "control left edge").toBeGreaterThanOrEqual(
              bounds.x,
            );
            expect(
              field.x + field.width,
              "control right edge",
            ).toBeLessThanOrEqual(bounds.x + bounds.width);
            await expect(target).toBeInViewport();
            const contentBounds = await target.evaluate((node) => ({
              width: node.clientWidth,
              contentWidth: node.scrollWidth,
            }));
            expect(
              contentBounds.contentWidth,
              "control content fits",
            ).toBeLessThanOrEqual(contentBounds.width);
            // A bounding box alone misses clipping and overlap by fixed drawer chrome.
            expect(
              await target.evaluate((node) => {
                const rect = node.getBoundingClientRect();
                return [rect.left + 2, rect.right - 2].every((x) =>
                  node.contains(
                    document.elementFromPoint(x, rect.top + rect.height / 2),
                  ),
                );
              }),
              "both control edges receive pointer input",
            ).toBe(true);
            return;
          }
          const maxDistance = Math.min(240, bounds.height - 120);
          const distance =
            field.y < top
              ? -Math.min(maxDistance, top - field.y + 16)
              : Math.min(maxDistance, field.y + field.height - bottom + 16);
          await swipe(distance);
          await expect
            .poll(async () => (await target.boundingBox())?.y)
            .not.toBe(field.y);
        }
        throw new Error("Touch scrolling did not reveal editor control");
      }
      const heading = dialog.getByRole("heading", {
        name: "Add playthrough",
        exact: true,
      });
      await expect(heading).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath(`editor-initial-32px-${theme}.png`),
      });
      const headerBounds = await heading.boundingBox();
      const beforeTouchScroll = await started.boundingBox();
      if (!headerBounds || !beforeTouchScroll)
        throw new Error("Editor has no bounds");
      // Start on the header even when the form is entirely below the viewport.
      await swipe(180, {
        x: headerBounds.x + 4,
        y: headerBounds.y + headerBounds.height - 8,
      });
      await expect
        .poll(async () => (await started.boundingBox())?.y ?? 0)
        .toBeLessThan(beforeTouchScroll.y - 100);
      const platform = page.getByRole("combobox", {
        name: "Platform",
        exact: true,
      });
      await touchReveal(platform);
      await expect(platform).toBeInViewport();
      await platform.tap();
      await page.getByRole("option", { name: "PC", exact: true }).tap();
      await touchReveal(started);
      await expect(started).toBeInViewport();
      await started.tap();
      await page.screenshot({
        path: testInfo.outputPath(`editor-date-picker-32px-${theme}.png`),
      });
      // Escape dismisses the native date picker before it can dismiss the editor.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await started.fill("2026-02-02");
      for (const label of [
        "Finished (optional)",
        "Hours (optional)",
        "Notes (private, optional)",
      ]) {
        const field = page.getByLabel(label);
        await touchReveal(field);
        await expect(field).toBeInViewport();
      }
      await page.getByLabel("Finished (optional)").fill("2026-01-01");
      await page.getByLabel("Hours (optional)").fill("3");
      await page
        .getByLabel("Notes (private, optional)")
        .fill("An ordinary private note");
      const save = page.getByRole("button", { name: "Save", exact: true });
      await touchReveal(save);
      await save.tap();
      await touchReveal(dialog.getByRole("alert"));
      await expect(dialog.getByRole("alert")).toBeInViewport();
      await expect(dialog.getByRole("alert")).toContainText("can't end before");
      await page.keyboard.press("Escape");
      await expect(add).toBeFocused();
      await add.tap();
      await touchReveal(started);
      await expect(started).toHaveValue("2026-02-02");
      await page.getByLabel("Finished (optional)").fill("");
      await touchReveal(started);
      expect(
        await dialog.evaluate((node) => node.scrollWidth),
      ).toBeLessThanOrEqual(320);
      await page.screenshot({
        path: testInfo.outputPath(`editor-32px-${theme}.png`),
      });
      await touchReveal(save);
      await save.tap();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByText("An ordinary private note", { exact: true }),
      ).toBeVisible();
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "16px";
      });
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      // A text-size change after opening and a keyboard-reduced viewport must also reflow.
      await expect(page.locator("html")).toHaveCSS("font-size", "16px");
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "32px";
      });
      await page.setViewportSize({ width: 320, height: 400 });
      await touchReveal(started);
      await expect(started).toBeInViewport();
      await expect(started).toHaveValue("2026-02-02");
      await page.getByLabel("Hours (optional)").fill("4");
      await touchReveal(save);
      await page.screenshot({
        path: testInfo.outputPath(`editor-save-short-32px-${theme}.png`),
      });
      await save.tap();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(/4 h/)).toBeVisible();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      const remove = page.getByRole("button", { name: "Delete playthrough" });
      await touchReveal(remove);
      await expect(remove).toBeInViewport();
      await remove.focus();
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press("Tab");
        await expect
          .poll(() =>
            dialog.evaluate((node) => node.contains(document.activeElement)),
          )
          .toBe(true);
      }
      await page
        .getByLabel("Notes (private, optional)")
        .fill("Discard this enlarged-text draft");
      const cancel = page.getByRole("button", { name: "Cancel", exact: true });
      await touchReveal(cancel);
      await cancel.tap();
      await expect(dialog).toHaveCount(0);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("Notes (private, optional)")).toHaveValue(
        "An ordinary private note",
      );
      await expect(page.getByLabel("Hours (optional)")).toHaveValue("4");
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Edit", exact: true }),
      ).toBeFocused();
      await cdp.detach();
    });
  }
});

test("F04: saved private notes wrap long URLs without changing their contents", async ({
  page,
  request,
}) => {
  await signUp(page, request, `notes_wrap_${Date.now()}`);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/games/celeste");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await page.getByLabel("Started", { exact: true }).fill("2026-02-02");
  const notes = page.getByLabel("Notes (private, optional)");
  await notes.fill("An ordinary private note");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("An ordinary private note", { exact: true }),
  ).toBeVisible();
  const ordinaryWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(ordinaryWidth).toBe(320);
  const fullNote =
    "An ordinary private note\nhttps://www.example.com/walkthroughs/celeste/chapter-seven-summit/crystal-heart-locations-and-all-strawberries\n日本語 café 🏔️ <b>literal markup</b>";
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await notes.fill(fullNote);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Playthroughs" })
      .locator("p")
      .filter({ hasText: "https://www.example.com" }),
  ).toHaveText(fullNote);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    ordinaryWidth,
  );
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(notes).toHaveValue(fullNote);
});
