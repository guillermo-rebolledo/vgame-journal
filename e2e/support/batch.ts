import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Db } from "../../src/db";
import { supportUrl } from "./url";

/** Send the whole transaction to the shared PGlite server, never separate HTTP requests. */
export async function executeBatch(_db: Db, statements: [SQL, SQL, ...SQL[]]) {
  const dialect = new PgDialect();
  const response = await fetch(supportUrl("/batch"), {
    method: "POST",
    body: JSON.stringify(
      statements.map((statement) => dialect.sqlToQuery(statement)),
    ),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()).rows as unknown[];
}
