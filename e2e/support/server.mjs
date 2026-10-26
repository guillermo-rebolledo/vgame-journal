import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const database = new PGlite();
await migrate(drizzle(database), { migrationsFolder: "./drizzle" });
const mailbox = [];
const server = createServer(async (request, response) => {
  try {
    let body = "";
    for await (const chunk of request) body += chunk;
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/query" && request.method === "POST") {
      const { sql, params } = JSON.parse(body);
      const result = await database.query(sql, params, {
        rowMode: "array",
        parsers: {
          1082: (value) => value,
          1114: (value) => value,
          1184: (value) => value,
        },
      });
      response.end(JSON.stringify({ rows: result.rows }));
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
