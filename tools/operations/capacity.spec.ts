import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { chooseStatus } from "../../e2e/support/journal";
import { seedSql } from "../../e2e/support/seed-sql";
import { signUp, uniqueUsername } from "../../e2e/support/sign-up";
import { approveTarget } from "./monitor.mjs";
import { summarize } from "./performance.mjs";

const dataset = Number(process.env.OPS_GAMES ?? 100);
const users = Number(process.env.OPS_USERS ?? 5);
const iterations = Number(process.env.OPS_ITERATIONS ?? 20);
if (
  ![0, 100, 1000].includes(dataset) ||
  ![5, 20].includes(users) ||
  !Number.isInteger(iterations) ||
  iterations < 1 ||
  iterations > 100
) {
  throw new Error(
    "Use OPS_GAMES=0|100|1000, OPS_USERS=5|20, OPS_ITERATIONS=1..100",
  );
}

test("isolated Journal capacity measurements", async ({
  browser,
  request,
  baseURL,
}) => {
  const origin = approveTarget(baseURL, "http://127.0.0.1:3410");
  const samples: {
    operation: string;
    mode: string;
    ms: number;
    ok: boolean;
    failure?: string;
  }[] = [];
  let httpRequests = 0;
  let httpErrors = 0;
  const startedAt = new Date().toISOString();
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const clients = [];
  try {
    // Setup is outside measured windows. Every user has a separate account and cookie jar.
    for (let i = 0; i < users; i++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: "block",
      });
      context.setDefaultNavigationTimeout(15000);
      context.setDefaultTimeout(10000);
      clients.push(context);
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.origin === origin ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const email = await signUp(page, request, uniqueUsername("ops"));
      await seedSql(
        request,
        [
          `insert into game (id,title,slug,genres,platforms,synced_at)
         select n, 'Synthetic game ' || n, 'ops-' || n, '{}', '{PC}', now()
         from generate_series(800000,800999) n on conflict do nothing`,
          `insert into journal_entry(user_id,game_id,status,updated_at)
         select u.id,n,case when n%4=0 then 'wishlist' when n%4=1 then 'playing' when n%4=2 then 'played' else 'backlog' end,now()
         from "user" u cross join generate_series(800000,${799999 + dataset}) n where u.email=$1`,
          `insert into playthrough(user_id,game_id,platform,started_on,hours,notes)
         select u.id,n,'PC',date '2025-01-01'+p,2,'Synthetic note'
         from "user" u cross join generate_series(800000,${799999 + dataset}) n cross join generate_series(0,2) p
         where u.email=$1 and n%4 in (1,2)`,
        ],
        [email],
      );
      await page.goto("/games/celeste");
    }
    // First-navigation is a browser/cache condition, not a hosted function cold start.
    for (const mode of ["first-navigation", "warm", "slow-network"]) {
      console.log(
        `Synthetic capacity: ${dataset} games, ${users} users, ${mode}`,
      );
      await Promise.all(
        clients.map(async (context) => {
          const page = context.pages()[0];
          const cdp = await context.newCDPSession(page);
          if (mode === "slow-network")
            await cdp.send("Network.emulateNetworkConditions", {
              offline: false,
              latency: 150,
              downloadThroughput: 200000,
              uploadThroughput: 93750,
            });
          page.on("request", () => {
            httpRequests++;
          });
          page.on("response", (response) => {
            if (response.status() >= 400) httpErrors++;
          });
          const routes = [
            ["home", "/"],
            ["catalog-search", "/?q=Celeste"],
            ["library", "/library"],
            ["wishlist", "/wishlist"],
            ["game", "/games/ops-800000"],
          ];
          for (
            let round = 0;
            round < (mode === "first-navigation" ? 1 : iterations);
            round++
          ) {
            for (const [operation, path] of routes) {
              const start = performance.now();
              let ok = false;
              try {
                const response = await page.goto(`${origin}${path}`, {
                  waitUntil: "commit",
                  timeout: 15000,
                });
                expect(response?.ok()).toBe(true);
                await expect(page.locator("main")).toBeVisible();
                await expect(
                  page.getByRole("heading", { level: 1 }).first(),
                ).toBeVisible();
                if (operation === "home")
                  await expect(
                    page.getByRole("link", {
                      name: /^All saved games \(\d+\)$/,
                    }),
                  ).toBeVisible();
                if (operation === "catalog-search")
                  await expect(
                    page
                      .locator(".game-catalog-result")
                      .filter({ hasText: "Celeste" })
                      .first(),
                  ).toBeVisible();
                if (operation === "wishlist")
                  await expect(
                    page.locator('[aria-label="Wishlist updates"]'),
                  ).toBeAttached();
                if (
                  operation === "library" &&
                  !dataset &&
                  mode === "first-navigation"
                )
                  await expect(
                    page.getByText("Your library is empty.", { exact: true }),
                  ).toBeVisible();
                if (operation === "game")
                  await expect(
                    page.getByRole("region", {
                      name: "Game journal",
                      exact: true,
                    }),
                  ).toBeVisible();
                if (
                  operation === "library" &&
                  !dataset &&
                  mode !== "first-navigation"
                )
                  await expect(
                    page.getByText("1 game", { exact: true }).first(),
                  ).toBeVisible();
                if (operation === "library" && dataset)
                  await expect(
                    page.getByText(`${dataset} games`, { exact: true }).first(),
                  ).toBeVisible();
                ok = true;
              } catch {
                /* Record bounded failure, never page content or URLs. */
              }
              samples.push({
                operation,
                mode,
                ms: Math.round(performance.now() - start),
                ok,
              });
            }
            const start = performance.now();
            let ok = false;
            let failure = "status-control";
            try {
              const offset =
                mode === "first-navigation"
                  ? 0
                  : mode === "warm"
                    ? 1
                    : iterations + 1;
              const playing = (round + offset) % 2 === 0;
              await chooseStatus(page, playing ? "playing" : "backlog");
              failure = "export-read";
              const response = await context.request.get(
                `${origin}/api/account/export`,
              );
              expect(response.ok()).toBe(true);
              failure = "export-correctness";
              const exported = await response.json();
              const entries = exported.entries.filter(
                (entry: { gameId: number }) => entry.gameId === 800000,
              );
              expect(entries).toHaveLength(1);
              expect(entries[0].status).toBe(playing ? "playing" : "backlog");
              ok = true;
            } catch {
              /* Preserve failure count without recording Journal contents. */
            }
            samples.push({
              operation: "journal-save-and-verify",
              ...(!ok ? { failure } : {}),
              mode,
              ms: Math.round(performance.now() - start),
              ok,
            });
          }
          page.removeAllListeners("request");
          page.removeAllListeners("response");
          await cdp.detach();
        }),
      );
    }
  } finally {
    await Promise.allSettled(clients.map((context) => context.close()));
    const cells = [
      ...new Set(samples.map((sample) => `${sample.mode}:${sample.operation}`)),
    ].map((key) => {
      const [mode, operation] = key.split(":");
      return {
        mode,
        operation,
        ...summarize(
          samples.filter(
            (sample) => sample.mode === mode && sample.operation === operation,
          ),
        ),
      };
    });
    const report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      revision,
      environment:
        "loopback-next-production-build-with-PGlite-and-fake-providers",
      datasetGamesPerUser: dataset,
      playthroughs: "3 per Played/Playing game",
      users,
      iterations,
      viewport: "390x844",
      slowNetwork: "150ms RTT, 1.6Mbps down, 750kbps up",
      httpRequests,
      httpErrors,
      cells,
      samples,
      providerCalls: null,
      databaseUsage: null,
      hostedColdStarts: null,
      fieldWebVitals: null,
      firstLimitingResource: "pending operator analysis",
    };
    await mkdir("test-results/operations-reports", { recursive: true });
    await writeFile(
      `test-results/operations-reports/capacity-${dataset}-${users}.json`,
      JSON.stringify(report, null, 2),
    );
  }
  expect(
    samples.filter((sample) => !sample.ok),
    "See bounded operation/mode failures in JSON",
  ).toHaveLength(0);
});
