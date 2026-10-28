import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const database = new PGlite();
await migrate(drizzle(database), { migrationsFolder: "./drizzle" });
const mailbox = [];
const collectionDelays = new Map();
const discoveryState = { fail: false, hold: false };
const discoveryWaiters = [];
const server = createServer(async (request, response) => {
  try {
    let body = "";
    for await (const chunk of request) body += chunk;
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/query" && request.method === "POST") {
      const { sql, params } = JSON.parse(body);
      if (sql.includes('from "discovery_snapshot"')) {
        if (discoveryState.fail)
          throw new Error("Synthetic discovery read failure");
        if (discoveryState.hold)
          await new Promise((resolve) => discoveryWaiters.push(resolve));
      }
      const delay = collectionDelays.get(params?.[0]);
      if (delay && sql.includes('from "journal_entry"'))
        await new Promise((resolve) => setTimeout(resolve, delay));
      const result = await database.query(sql, params, {
        rowMode: "array",
        parsers: {
          1082: (value) => value,
          1114: (value) => value,
          1184: (value) => value,
        },
      });
      response.end(JSON.stringify({ rows: result.rows }));
    } else if (
      request.url === "/collection-delay" &&
      request.method === "POST"
    ) {
      const { email, milliseconds } = JSON.parse(body);
      const { rows } = await database.query(
        'select id from "user" where email = $1',
        [email],
      );
      if (!rows.length) throw new Error("Unknown test user");
      collectionDelays.set(rows[0].id, milliseconds);
      response.end("{}");
    } else if (
      request.url === "/discovery-state" &&
      request.method === "POST"
    ) {
      Object.assign(discoveryState, JSON.parse(body));
      if (!discoveryState.hold)
        for (const resolve of discoveryWaiters.splice(0)) resolve();
      response.end("{}");
    } else if (request.url === "/emails" && request.method === "POST") {
      mailbox.push(JSON.parse(body));
      response.end(JSON.stringify({ id: String(mailbox.length) }));
    } else if (request.url === "/mailbox") {
      response.end(JSON.stringify(mailbox));
    } else if (request.url === "/health") {
      response.end("{}");
    } else {
      response.writeHead(404).end("{}");
    }
  } catch (error) {
    response.writeHead(500).end(JSON.stringify({ error: error.message }));
  }
});
server.listen(3101, "127.0.0.1");
