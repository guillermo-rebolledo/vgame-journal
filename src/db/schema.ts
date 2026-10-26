// Better Auth tables (`npx @better-auth/cli generate`), plus the username plugin columns.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { DatePrecision } from "@/lib/game-source";
import type { CompletionTag, Status } from "@/lib/journal";
import type { Region } from "@/lib/release-dates";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    username: text("username").unique(),
    displayUsername: text("display_username"),
    /** Whose release dates the user's Countdowns follow. */
    region: text("region").$type<Region>().notNull().default("earliest"),
    /** Secret in the user's calendar feed URL; null until they first see it. */
    feedToken: text("feed_token").unique(),
  },
  (table) => [
    check(
      "user_region_known",
      sql`${table.region} in ('earliest', 'north_america', 'europe', 'japan')`,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Catalog: our local copy of games, keyed by the GameSource (IGDB) id.
export const game = pgTable(
  "game",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary"),
    coverImageId: text("cover_image_id"),
    genres: text("genres").array().notNull(),
    platforms: text("platforms").array().notNull(),
    criticScore: real("critic_score"),
    criticScoreCount: integer("critic_score_count"),
    userScore: real("user_score"),
    userScoreCount: integer("user_score_count"),
    syncedAt: timestamp("synced_at").notNull(),
  },
  (table) => [index("game_slug_idx").on(table.slug)],
);

export const releaseDate = pgTable(
  "release_date",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    platform: text("platform"),
    region: text("region").notNull(),
    date: timestamp("date"),
    precision: text("precision").$type<DatePrecision>().notNull(),
    status: text("status"),
  },
  (table) => [index("release_date_gameId_idx").on(table.gameId)],
);

/** External search results, so a repeated query within 24h is served from the Catalog. */
export const searchCache = pgTable("search_cache", {
  query: text("query").primaryKey(),
  gameIds: integer("game_ids").array().notNull(),
  fetchedAt: timestamp("fetched_at").notNull(),
});

// Journal: one entry per user and game. A Completion tag only goes with Played.
export const journalEntry = pgTable(
  "journal_entry",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    status: text("status").$type<Status>().notNull(),
    completionTag: text("completion_tag").$type<CompletionTag>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameId] }),
    check(
      "journal_entry_tag_only_when_played",
      sql`${table.completionTag} is null or ${table.status} = 'played'`,
    ),
  ],
);

/** Every status change, so stats can chart the backlog over time. A null status means removed. */
export const statusEvent = pgTable(
  "status_event",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    status: text("status").$type<Status>(),
    completionTag: text("completion_tag").$type<CompletionTag>(),
    at: timestamp("at").notNull(),
  },
  (table) => [index("status_event_userId_idx").on(table.userId)],
);

/** One dated session of playing a game. Goes away with its journal entry. */
export const playthrough = pgTable(
  "playthrough",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    gameId: integer("game_id").notNull(),
    platform: text("platform").notNull(),
    startedOn: date("started_on").notNull(),
    endedOn: date("ended_on"),
    hours: numeric("hours", { precision: 7, scale: 2, mode: "number" }),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.gameId],
      foreignColumns: [journalEntry.userId, journalEntry.gameId],
    }).onDelete("cascade"),
    index("playthrough_userId_gameId_idx").on(table.userId, table.gameId),
    check(
      "playthrough_ends_after_start",
      sql`${table.endedOn} is null or ${table.endedOn} >= ${table.startedOn}`,
    ),
    check(
      "playthrough_hours_not_negative",
      sql`${table.hours} is null or ${table.hours} >= 0`,
    ),
  ],
);
