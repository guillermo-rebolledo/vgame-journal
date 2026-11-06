import { randomInt, randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { seedSql } from "./seed-sql";

/**
 * A Catalog game only this test rates, with one seeded player per entry of `points`.
 * Tests share one database and Community ratings are cached per game, so each needs its own game.
 */
export async function seedRatedGame(
  request: APIRequestContext,
  points: number[] = [],
) {
  const id = randomInt(950_000, 2_000_000_000);
  const slug = `rating-fixture-${id}`;
  const title = `Rating Fixture ${id}`;
  const statements = [
    `insert into game (id, slug, title, genres, platforms, synced_at) values (${id}, '${slug}', '${title}', '{}', '{PC}', now())`,
  ];
  for (const value of points) {
    const user = randomUUID();
    statements.push(
      `insert into "user" (id, name, email, email_verified) values ('${user}', 'Rater', '${user}@example.com', true)`,
      `insert into journal_entry (user_id, game_id, status, updated_at, rating, rated_at) values ('${user}', ${id}, 'played', now(), ${value}, now())`,
    );
  }
  await seedSql(request, statements, []);
  return { slug, title };
}
