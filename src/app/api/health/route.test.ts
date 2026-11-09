import { afterEach, expect, test, vi } from "vitest";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(async () => undefined),
}));
vi.mock("@/db", () => ({ db: { execute } }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
const { GET } = await import("./route");
afterEach(() => vi.resetAllMocks());

test("public health checks a cheap application read and returns a fixed marker", async () => {
  execute.mockResolvedValue(undefined);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    service: "shelve.games",
    version: 1,
  });
  expect(execute).toHaveBeenCalledOnce();
});

test("database failure cannot certify health or expose its error", async () => {
  execute.mockRejectedValue(new Error("private connection and SQL"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});
