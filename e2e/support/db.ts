import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "../../src/db/schema";

export type { Db } from "../../src/db";

// Next's E2E-only alias connects every server worker to the same in-memory Postgres.
export const db = drizzle(
  async (sql, params) => {
    const response = await fetch("http://127.0.0.1:3101/query", {
      method: "POST",
      body: JSON.stringify({ sql, params }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  { schema },
);
