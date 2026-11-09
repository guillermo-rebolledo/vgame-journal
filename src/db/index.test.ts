import { sql } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("database transport has an explicit deadline and never retries an uncertain write", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@isolated.test/db");
  const controller = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(controller.signal);
  const fetcher = vi.fn(async (_url, options) => {
    expect(options.signal).toBe(controller.signal);
    throw new DOMException("private SQL and parameters", "TimeoutError");
  });
  vi.stubGlobal("fetch", fetcher);
  const { db } = await import("./index");
  await expect(
    db.execute(sql`update synthetic_record set value = 1`),
  ).rejects.toThrow();
  expect(timeout).toHaveBeenCalledWith(10_000);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledWith(
    expect.stringContaining('"operation":"database.request"'),
  );
  expect(JSON.stringify(log.mock.calls)).not.toMatch(
    /private SQL|isolated.test/,
  );
});
