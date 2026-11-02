import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Db } from "../../src/db";

/** Send the whole transaction to the shared PGlite server, never separate HTTP requests. */
export async function executeBatch(_db: Db, statements: [SQL, SQL]) {
  const dialect = new PgDialect();
  const response = await fetch("http://127.0.0.1:3101/batch", {
    method: "POST",
    body: JSON.stringify(
      statements.map((statement) => dialect.sqlToQuery(statement)),
    ),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()).rows as unknown[];
}
