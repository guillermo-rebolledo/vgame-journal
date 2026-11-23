import { sql } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import { onRequestError } from "@/instrumentation";
import { installErrorCapture } from "@/lib/operational-errors";
import { createFakeGameSource } from "@/test/fake-game-source";

afterEach(() => {
  installErrorCapture(() => {});
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

test("the Catalog slug SELECT retries one Neon timeout with a fresh deadline", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@isolated.test/db");
  const timeout = vi.spyOn(AbortSignal, "timeout");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new DOMException("private detail", "TimeoutError"))
    .mockResolvedValueOnce(Response.json({ fields: [], rows: [] }));
  vi.stubGlobal("fetch", fetcher);
  const { catalog, source } = await testCatalog();

  await expect(catalog.findBySlug("synthetic")).resolves.toBeNull();
  expect(source.fetchBySlug).toHaveBeenCalledOnce();
  expect(timeout.mock.calls).toEqual([[10_000], [10_000]]);
  const [[, first], [, second]] = fetcher.mock.calls;
  expect(first?.body).toContain("select");
  expect(second?.body).toBe(first?.body);
  expect(second?.signal).toBeDefined();
  expect(second?.signal).not.toBe(first?.signal);
});

test("two Neon timeouts reach server render monitoring with a timeout code", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@isolated.test/db");
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    throw new DOMException("private detail", "TimeoutError");
  });
  vi.stubGlobal("fetch", fetcher);
  const capture = vi.fn();
  installErrorCapture(capture);
  const { catalog, source } = await testCatalog();

  const lookup = catalog.findBySlug("synthetic");
  await expect(lookup).rejects.toThrow();
  const error = await lookup.catch((reason: unknown) => reason);
  await onRequestError(
    error,
    { path: "/games/synthetic", method: "GET", headers: {} },
    {
      routerKind: "App Router",
      routeType: "render",
      routePath: "/games/[slug]",
      renderSource: "react-server-components",
      revalidateReason: undefined,
    },
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(source.fetchBySlug).not.toHaveBeenCalled();
  expect(capture).toHaveBeenCalledExactlyOnceWith(
    error,
    "server.render",
    "timeout",
  );
});

async function testCatalog() {
  const { createCatalog } = await import("@/lib/catalog");
  const { db } = await import("./index");
  const source = createFakeGameSource([]);
  vi.spyOn(source, "fetchBySlug");
  return { catalog: createCatalog(db, source), source };
}
