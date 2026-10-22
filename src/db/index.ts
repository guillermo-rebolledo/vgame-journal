import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export const db = drizzle(neon(process.env.DATABASE_URL ?? ""), { schema });

/** The app's Neon database or a test PGlite one. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
