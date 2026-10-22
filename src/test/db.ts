import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

/** Fresh in-memory Postgres per call, with all migrations applied. */
export async function createTestDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle"),
  });
  return db;
}
