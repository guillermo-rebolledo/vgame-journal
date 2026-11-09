import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";
import * as schema from "./schema";

// A fresh signal per HTTP query/batch; never retry a possibly committed write.
neonConfig.fetchFunction = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const deadline = AbortSignal.timeout(10_000);
  try {
    const response = await fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, deadline])
        : deadline,
    });
    if (!response.ok)
      reportOperationalError(
        "database.request",
        response.status === 429 ? "rate_limited" : "unavailable",
      );
    return response;
  } catch (error) {
    reportOperationalError("database.request", operationalCode(error));
    throw error;
  }
};

// Journal batches acquire their lock before reading fresh statement snapshots.
export const db = drizzle(
  neon(process.env.DATABASE_URL ?? "", { isolationLevel: "ReadCommitted" }),
  { schema },
);

/** The app's Neon database or a test PGlite one. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
