import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Journal batches acquire their lock before reading fresh statement snapshots.
export const db = drizzle(
  neon(process.env.DATABASE_URL ?? "", { isolationLevel: "ReadCommitted" }),
  { schema },
);

/** The app's Neon database or a test PGlite one. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
