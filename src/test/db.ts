import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

/** Fresh in-memory Postgres per call; a migration prefix supports upgrade rehearsals. */
export async function createTestDb(
  migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle"),
) {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, {
    migrationsFolder,
  });
  return db;
}
