import { is, type SQL } from "drizzle-orm";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { Db } from "@/db";

/** Atomically execute a lock then a write, returning the write's rows. */
export async function executeBatch(db: Db, statements: [SQL, SQL]) {
  let result: unknown;
  if (is(db, NeonHttpDatabase)) {
    [, result] = await db.batch([
      db.execute(statements[0]),
      db.execute(statements[1]),
    ]);
  } else {
    // PGlite supports interactive transactions rather than Neon's HTTP batch API.
    result = await db.transaction(
      async (tx) => {
        await tx.execute(statements[0]);
        return tx.execute(statements[1]);
      },
      { isolationLevel: "read committed" },
    );
  }
  return (result as { rows: unknown[] }).rows;
}
