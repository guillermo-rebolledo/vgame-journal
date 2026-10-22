import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import journal from "../../drizzle/meta/_journal.json";
import { createTestDb } from "./db";

test("creates a fresh in-memory Postgres with every migration applied", async () => {
  const db = await createTestDb();

  const { rows } = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
  );

  expect(rows[0].count).toBe(journal.entries.length);
});
