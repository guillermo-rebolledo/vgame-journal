import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, test } from "vitest";
import journal from "../../drizzle/meta/_journal.json";
import { createTestDb } from "./db";

// Frozen pre-refresh-task baseline. Update deliberately when rehearsing a newer release.
const baseline = 18;
const migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle");

async function migrationPrefix(count: number) {
  const folder = await mkdtemp(path.join(os.tmpdir(), "journal-migrations-"));
  await mkdir(path.join(folder, "meta"));
  const entries = journal.entries.slice(0, count);
  await writeFile(
    path.join(folder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  for (const entry of entries) {
    const filename = `${entry.tag}.sql`;
    await writeFile(
      path.join(folder, filename),
      await readFile(path.join(migrationsFolder, filename)),
    );
  }
  return folder;
}

test("pending migrations preserve populated records and prior-schema reads and writes", async () => {
  const folder = await migrationPrefix(baseline + 1);
  const db = await createTestDb(folder);
  try {
    expect(
      (await db.execute(sql`select * from drizzle.__drizzle_migrations`)).rows,
    ).toHaveLength(baseline + 1);
    await db.$client.exec(`
      insert into "user" (id, name, email, username, email_verified)
        values ('release-user', 'Synthetic Player', 'release@example.invalid', 'release_player', true);
      insert into session (id, token, expires_at, updated_at, user_id)
        values ('release-session', 'synthetic-session', '2099-01-01', now(), 'release-user');
    `);
    const fixture = await readFile(
      path.join(import.meta.dirname, "fixtures/release.sql"),
      "utf8",
    );
    await db.$client.exec(
      fixture.replaceAll(":'release_user_id'", "'release-user'"),
    );
    const records = async () =>
      (
        await db.execute(sql`
      select row_to_json(u) as player, row_to_json(s) as session,
        row_to_json(j) as entry, row_to_json(h) as history,
        row_to_json(p) as playthrough, row_to_json(l) as list, row_to_json(e) as membership
      from "user" u join session s on s.user_id = u.id
        join journal_entry j on j.user_id = u.id
        join status_event h on h.user_id = u.id
        join playthrough p on p.user_id = u.id
        join custom_list l on l.user_id = u.id join list_entry e on e.list_id = l.id
    `)
      ).rows;
    const before = await records();
    expect(before).toHaveLength(1);
    await migrate(db, { migrationsFolder });
    expect(await records()).toEqual(before);
    // Prior-version column list still writes after expansion; this is not an old-artifact drill.
    await db.execute(
      sql`update playthrough set hours = 3, notes = 'Old writer after expansion' where user_id = 'release-user'`,
    );
    expect(
      (await db.execute(sql`select hours, notes from playthrough`)).rows,
    ).toEqual([{ hours: "3.00", notes: "Old writer after expansion" }]);
    await expect(
      db.execute(sql`update journal_entry set rating = 11`),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`update playthrough set ended_on = '2025-01-01'`),
    ).rejects.toThrow();
    await expect(
      db.execute(
        sql`insert into list_entry (list_id, game_id, position) values ('00000000-0000-4000-8000-000000000001', 999, 1)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.execute(
        sql`insert into journal_entry (user_id, game_id, status, updated_at) values ('release-user', 1, 'backlog', now())`,
      ),
    ).rejects.toThrow();
    await migrate(db, { migrationsFolder });
    expect(
      (await db.execute(sql`select * from drizzle.__drizzle_migrations`)).rows,
    ).toHaveLength(journal.entries.length);
  } finally {
    await db.$client.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("a failed migration rolls back and the corrected migration can be retried", async () => {
  const db = await createTestDb();
  const folder = await migrationPrefix(journal.entries.length);
  try {
    const latest = journal.entries[journal.entries.length - 1];
    const entry = {
      ...latest,
      idx: journal.entries.length,
      when: latest.when + 1,
      tag: "release_failure_drill",
    };
    await writeFile(
      path.join(folder, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: [...journal.entries, entry] }),
    );
    const filename = path.join(folder, `${entry.tag}.sql`);
    await writeFile(
      filename,
      "CREATE TABLE release_drill (id integer PRIMARY KEY);\n--> statement-breakpoint\nINSERT INTO missing_release_table VALUES (1);",
    );
    await expect(migrate(db, { migrationsFolder: folder })).rejects.toThrow();
    expect(
      (
        await db.execute(
          sql`select to_regclass('public.release_drill') as name`,
        )
      ).rows,
    ).toEqual([{ name: null }]);
    expect(
      (await db.execute(sql`select * from drizzle.__drizzle_migrations`)).rows,
    ).toHaveLength(journal.entries.length);
    await writeFile(
      filename,
      "CREATE TABLE release_drill (id integer PRIMARY KEY);\n--> statement-breakpoint\nINSERT INTO release_drill VALUES (1);",
    );
    await migrate(db, { migrationsFolder: folder });
    await migrate(db, { migrationsFolder: folder });
    expect((await db.execute(sql`select * from release_drill`)).rows).toEqual([
      { id: 1 },
    ]);
  } finally {
    await db.$client.close();
    await rm(folder, { recursive: true, force: true });
  }
});
