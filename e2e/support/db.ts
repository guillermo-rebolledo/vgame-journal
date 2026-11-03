import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "../../src/db/schema";
import { supportUrl } from "./url";

export type { Db } from "../../src/db";

// Next's E2E-only alias connects every server worker to the same in-memory Postgres.
export const db = drizzle(
  async (sql, params) => {
    const response = await fetch(supportUrl("/query"), {
      method: "POST",
      body: JSON.stringify({ sql, params }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  { schema },
);
