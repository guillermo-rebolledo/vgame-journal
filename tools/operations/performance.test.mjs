import assert from "node:assert/strict";
import { test } from "node:test";

test("small samples are raw diagnostics; sufficient samples report known percentiles and errors", async () => {
  const { summarize } = await import("./performance.mjs");
  assert.deepEqual(
    summarize([
      { ms: 10, ok: true },
      { ms: 99, ok: false },
    ]),
    {
      attempts: 2,
      errors: 1,
      p50Ms: null,
      p95Ms: null,
      minMs: 10,
      maxMs: 99,
    },
  );
  const result = summarize(
    Array.from({ length: 100 }, (_, i) => ({ ms: i + 1, ok: true })),
  );
  assert.equal(result.p50Ms, 50);
  assert.equal(result.p95Ms, 95);
});
