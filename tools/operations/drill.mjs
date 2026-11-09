import assert from "node:assert/strict";
import { createServer } from "node:http";
import { observe, probe, staleTasks } from "./monitor.mjs";

// No configurable remote destinations: even the alert receiver is ephemeral loopback.
const received = [];
let version = "known-good";
const journal = ["synthetic-record"];
const started = performance.now();
const server = createServer(async (request, response) => {
  if (request.url === "/alerts" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    received.push(JSON.parse(body));
    response.end("{}");
  } else if (request.url === "/read") response.end(`journal:${journal.length}`);
  else response.end(version);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const states = new Map();
async function check(key, healthy) {
  const { state, event } = observe(states.get(key), healthy);
  states.set(key, state);
  if (event) {
    const response = await fetch(`${origin}/alerts`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        check: key,
        event,
        code: "synthetic",
        timestamp: new Date().toISOString(),
      }),
    });
    assert.equal(response.ok, true);
  }
}
try {
  assert.equal(await probe(origin, origin, "/", "known-good"), true);
  assert.equal(await probe(origin, origin, "/read", "journal:1"), true);
  version = "bad-build";
  for (let i = 0; i < 3; i++)
    await check("uptime", await probe(origin, origin, "/", "known-good"));
  version = "known-good";
  for (let i = 0; i < 2; i++)
    await check("uptime", await probe(origin, origin, "/", "known-good"));
  const now = Date.parse("2026-11-09T12:00:00Z");
  const stale = staleTasks(
    [{ key: "wishlist", enabled: true, lastSuccessAt: null }],
    "2026-11-07T00:00:00Z",
    now,
  );
  for (let i = 0; i < 3; i++) await check("freshness", stale.length === 0);
  await check("freshness", true);
  assert.deepEqual(
    received.map(({ check, event }) => [check, event]),
    [
      ["uptime", "incident"],
      ["uptime", "recovery"],
      ["freshness", "incident"],
      ["freshness", "recovery"],
    ],
  );
  assert.equal(await probe(origin, origin, "/read", "journal:1"), true);
  console.log(
    JSON.stringify(
      {
        kind: "loopback-model-only",
        timestamp: new Date().toISOString(),
        elapsedMs: Math.round(performance.now() - started),
        events: received,
        syntheticRecordsPreserved: 1,
        dataRecoveryPoint: "no writes lost in in-memory model",
        hostedRollback: "pending",
        externalAlertDelivery: "pending",
      },
      null,
      2,
    ),
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
