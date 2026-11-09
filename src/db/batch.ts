import { is, type SQL } from "drizzle-orm";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { Db } from "@/db";

/** Atomically execute statements, returning the final statement’s rows. */
export async function executeBatch(db: Db, statements: [SQL, SQL, ...SQL[]]) {
  let result: unknown;
  if (is(db, NeonHttpDatabase)) {
    const results = await db.batch([
      db.execute(statements[0]),
      ...statements.slice(1).map((statement) => db.execute(statement)),
    ]);
    result = results.at(-1);
  } else {
    // PGlite supports interactive transactions rather than Neon's HTTP batch API.
    result = await db.transaction(
      async (tx) => {
        let result: unknown;
        for (const statement of statements)
          result = await tx.execute(statement);
        return result;
      },
      { isolationLevel: "read committed" },
    );
  }
  return (result as { rows: unknown[] }).rows;
}
