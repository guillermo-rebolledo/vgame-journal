import { neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { executeBatch } from "./batch";
import { db } from "./index";

vi.hoisted(() => {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://test:test@batch-contract.invalid/test",
  );
});
afterAll(() => vi.unstubAllEnvs());

const originalFetch = neonConfig.fetchFunction;
afterEach(() => {
  neonConfig.fetchFunction = originalFetch;
});

test("installed Neon HTTP adapter sends one transactional batch and returns its final rows", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          results: [
            { fields: [], rows: [], rowCount: 0, command: "SELECT" },
            { fields: [], rows: [], rowCount: 0, command: "UPDATE" },
            {
              fields: [{ name: "accepted", dataTypeID: 16 }],
              rows: [["t"]],
              rowCount: 1,
              command: "SELECT",
            },
          ],
        }),
        { status: 200 },
      ),
  );
  neonConfig.fetchFunction = fetch;
  expect(
    await executeBatch(db, [
      sql`select 1`,
      sql`select 2`,
      sql`select true as accepted`,
    ]),
  ).toEqual([{ accepted: true }]);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(new Headers(options.headers).get("Neon-Batch-Isolation-Level")).toBe(
    "ReadCommitted",
  );
  const body = JSON.parse(String(options.body));
  expect(body.queries).toHaveLength(3);
  expect(body).not.toHaveProperty("query");
});

test("Neon batch errors propagate without returning a success result", async () => {
  neonConfig.fetchFunction = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          message: "isolated constraint failure",
          code: "23514",
        }),
        { status: 400 },
      ),
  );
  await expect(
    executeBatch(db, [sql`select 1`, sql`select 2`]),
  ).rejects.toThrow("isolated constraint failure");
});
