import assert from "node:assert/strict";
import { test } from "node:test";
import { approveTarget } from "./monitor.mjs";

test("rejects production, redirects-to-production inputs and credential-bearing targets", () => {
  for (const target of [
    "https://shelve.games",
    "https://preview.vercel.app",
    "http://localhost:3100",
    "http://user:secret@127.0.0.1:3100",
    "http://127.0.0.1:3100/?token=secret",
  ]) {
    assert.throws(() => approveTarget(target));
    assert.throws(() => approveTarget(target, target));
  }
  assert.equal(
    approveTarget("http://127.0.0.1:3210", "http://127.0.0.1:3210"),
    "http://127.0.0.1:3210",
  );
});

test("two failures open one incident, repeat failures deduplicate, recovery resolves once", async () => {
  const { observe } = await import("./monitor.mjs");
  let state;
  const events = [];
  for (const healthy of [false, false, false, true, true, false, false]) {
    const result = observe(state, healthy);
    state = result.state;
    if (result.event) events.push(result.event);
  }
  assert.deepEqual(events, ["incident", "recovery", "incident"]);
});

test("freshness detects individual stale and never-successful tasks using controlled time", async () => {
  const { staleTasks } = await import("./monitor.mjs");
  const now = Date.parse("2026-11-09T12:00:00Z");
  assert.deepEqual(
    staleTasks(
      [
        {
          key: "wishlist",
          enabled: true,
          lastSuccessAt: "2026-11-08T05:59:59Z",
        },
        { key: "recent", enabled: true, lastSuccessAt: "2026-11-08T06:00:00Z" },
        { key: "popular", enabled: true, lastSuccessAt: null },
        { key: "disabled", enabled: false, lastSuccessAt: null },
      ],
      "2026-11-08T00:00:00Z",
      now,
    ),
    ["wishlist", "recent", "popular"],
  );
  assert.deepEqual(
    staleTasks(
      [{ key: "wishlist", enabled: true, lastSuccessAt: null }],
      "2026-11-09T00:00:00Z",
      now,
    ),
    [],
  );
  assert.throws(() =>
    staleTasks(
      [{ key: "wishlist", enabled: true, lastSuccessAt: "invalid" }],
      "2026-11-09T00:00:00Z",
      now,
    ),
  );
});

test("uptime requires marker, refuses redirects and times out without disclosing response content", async () => {
  const { createServer } = await import("node:http");
  const { probe } = await import("./monitor.mjs");
  const server = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "https://shelve.games" });
      res.end();
    } else if (req.url === "/hang") {
      /* probe must abort */
    } else res.end(req.url === "/good" ? "synthetic-ok" : "private-error-body");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await probe(origin, origin, "/good", "synthetic-ok"), true);
    assert.equal(await probe(origin, origin, "/bad", "synthetic-ok"), false);
    assert.equal(
      await probe(origin, origin, "/redirect", "synthetic-ok"),
      false,
    );
    assert.equal(
      await probe(origin, origin, "/hang", "synthetic-ok", 30),
      false,
    );
    await assert.rejects(
      probe(origin, origin, "//shelve.games", "synthetic-ok"),
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("an empty response marker cannot certify uptime", async () => {
  const { probe } = await import("./monitor.mjs");
  await assert.rejects(
    probe("http://127.0.0.1:3210", "http://127.0.0.1:3210", "/", ""),
  );
});
