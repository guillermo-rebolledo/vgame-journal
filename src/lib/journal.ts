import { and, eq, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import {
  game,
  journalEntry,
  playthrough,
  releaseDate,
  statusEvent,
} from "@/db/schema";
import {
  COMPLETION_TAGS,
  type CompletionTag,
  type LibraryEntry,
  type LibraryFilters,
  type LibrarySort,
  queryLibrary,
  STATUSES,
  type Status,
} from "@/lib/library";

export {
  COMPLETION_TAGS,
  type CompletionTag,
  STATUSES,
  type Status,
} from "@/lib/library";

/** A broken Journal rule. Its message is safe to show the user. */
export class JournalError extends Error {}

/** What a user fills in for a Playthrough. Dates are `YYYY-MM-DD`. */
export type PlaythroughInput = {
  platform: string;
  startedOn: string;
  endedOn?: string | null;
  hours?: number | null;
  notes?: string;
};

function isDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  // Unparseable months/days are NaN; Feb 30 parses but rolls over to March.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

/** Tests pass their own database. Every write is scoped to the given user's own entries. */
export function createJournal(db: Db) {
  /** The user's rows for a game: their journal entry, or that entry's playthroughs. */
  const owned = (
    userId: string,
    gameId: number,
    table: typeof journalEntry | typeof playthrough = journalEntry,
  ) => and(eq(table.userId, userId), eq(table.gameId, gameId));

  // ponytail: entry write and its event aren't atomic (neon-http has no transactions); a crash between them loses one event.
  const recordStatusEvent = (
    userId: string,
    gameId: number,
    status: Status | null,
    completionTag: CompletionTag | null,
    at: Date,
  ) =>
    db
      .insert(statusEvent)
      .values({ userId, gameId, status, completionTag, at });

  const ownedPlaythrough = (userId: string, id: number) =>
    and(eq(playthrough.userId, userId), eq(playthrough.id, id));

  /** Validates untrusted form input against the game it's for. */
  async function playthroughValues(gameId: number, input: PlaythroughInput) {
    const { platform, startedOn, endedOn = null, hours = null } = input;
    if (!isDay(startedOn) || (endedOn !== null && !isDay(endedOn)))
      throw new JournalError("Dates must be real days (YYYY-MM-DD).");
    // ISO days compare correctly as strings.
    if (endedOn !== null && endedOn < startedOn)
      throw new JournalError("A playthrough can't end before it starts.");
    if (hours !== null && !(hours >= 0 && hours < 100_000))
      throw new JournalError("Hours must be between 0 and 99,999.");
    const [found] = await db
      .select({ platforms: game.platforms })
      .from(game)
      .where(eq(game.id, gameId));
    if (!found?.platforms.includes(platform))
      throw new JournalError(`Not a platform for this game: ${platform}`);
    return { platform, startedOn, endedOn, hours, notes: input.notes ?? "" };
  }

  async function entry(userId: string, gameId: number) {
    const [found] = await db
      .select()
      .from(journalEntry)
      .where(owned(userId, gameId));
    return found ?? null;
  }

  return {
    /** The user's entry for a game, or null if it isn't in their journal. */
    entry,

    /** Adds the game to the user's journal, or changes its status and tag. */
    async set(
      userId: string,
      gameId: number,
      {
        status,
        completionTag = null,
      }: { status: Status; completionTag?: CompletionTag | null },
    ) {
      if (!STATUSES.includes(status))
        throw new JournalError(`Unknown status: ${status}`);
      if (completionTag !== null && !COMPLETION_TAGS.includes(completionTag))
        throw new JournalError(`Unknown completion tag: ${completionTag}`);
      if (completionTag !== null && status !== "played")
        throw new JournalError("Only played games get a completion tag.");
      const current = await entry(userId, gameId);
      if (current?.status === status && current.completionTag === completionTag)
        return;
      const updatedAt = new Date();
      await db
        .insert(journalEntry)
        .values({
          userId,
          gameId,
          status,
          completionTag,
          createdAt: updatedAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [journalEntry.userId, journalEntry.gameId],
          set: { status, completionTag, updatedAt },
        });
      await recordStatusEvent(userId, gameId, status, completionTag, updatedAt);
    },

    /** Takes the game out of the user's journal. */
    async remove(userId: string, gameId: number) {
      const removed = await db
        .delete(journalEntry)
        .where(owned(userId, gameId))
        .returning();
      if (removed.length)
        await recordStatusEvent(userId, gameId, null, null, new Date());
    },

    /** The user's status changes, oldest first. A null status is a removal. */
    statusEvents: (userId: string) =>
      db
        .select({
          gameId: statusEvent.gameId,
          status: statusEvent.status,
          completionTag: statusEvent.completionTag,
          at: statusEvent.at,
        })
        .from(statusEvent)
        .where(eq(statusEvent.userId, userId))
        .orderBy(statusEvent.at, statusEvent.id),

    /** Logs a playthrough on the user's entry for a game. */
    async addPlaythrough(
      userId: string,
      gameId: number,
      input: PlaythroughInput,
    ) {
      if (!(await entry(userId, gameId)))
        throw new JournalError("This game is not in your journal.");
      const values = await playthroughValues(gameId, input);
      await db.insert(playthrough).values({ userId, gameId, ...values });
    },

    /** Replaces the details of one of the user's playthroughs. Others' are left alone. */
    async updatePlaythrough(
      userId: string,
      id: number,
      input: PlaythroughInput,
    ) {
      const [found] = await db
        .select({ gameId: playthrough.gameId })
        .from(playthrough)
        .where(ownedPlaythrough(userId, id));
      if (!found) return;
      const values = await playthroughValues(found.gameId, input);
      await db
        .update(playthrough)
        .set(values)
        .where(ownedPlaythrough(userId, id));
    },

    /** Deletes one of the user's playthroughs. Others' are left alone. */
    async removePlaythrough(userId: string, id: number) {
      await db.delete(playthrough).where(ownedPlaythrough(userId, id));
    },

    /** The user's Journal as Library entries, filtered and sorted (most recently added first by default). */
    async library(
      userId: string,
      filters?: LibraryFilters,
      sort?: LibrarySort,
    ): Promise<LibraryEntry[]> {
      const [entries, playthroughs] = await Promise.all([
        db
          .select({
            gameId: game.id,
            title: game.title,
            slug: game.slug,
            coverImageId: game.coverImageId,
            status: journalEntry.status,
            completionTag: journalEntry.completionTag,
            addedAt: journalEntry.createdAt,
            releasedAt: sql<Date | null>`(
              select min(${releaseDate.date}) from ${releaseDate}
              where ${releaseDate.gameId} = ${game.id} and ${releaseDate.precision} <> 'tbd'
            )`.mapWith(releaseDate.date),
          })
          .from(journalEntry)
          .innerJoin(game, eq(game.id, journalEntry.gameId))
          .where(eq(journalEntry.userId, userId)),
        db
          .select({
            gameId: playthrough.gameId,
            platform: playthrough.platform,
            startedOn: playthrough.startedOn,
            endedOn: playthrough.endedOn,
          })
          .from(playthrough)
          .where(eq(playthrough.userId, userId)),
      ]);
      const thisYear = new Date().getUTCFullYear();
      const library = entries.map((entry) => {
        const own = playthroughs.filter((p) => p.gameId === entry.gameId);
        const years = own.flatMap((p) => {
          const from = Number(p.startedOn.slice(0, 4));
          const to = p.endedOn ? Number(p.endedOn.slice(0, 4)) : thisYear;
          return Array.from(
            { length: Math.max(to, from) - from + 1 },
            (_, i) => from + i,
          );
        });
        return {
          ...entry,
          platforms: [...new Set(own.map((p) => p.platform))],
          years: [...new Set(years)],
        };
      });
      // ponytail: filters in memory, fine for a personal journal's hundreds of games; push into SQL if libraries get huge.
      return queryLibrary(library, filters, sort);
    },

    /** The user's playthroughs of a game, oldest first. */
    playthroughs: (userId: string, gameId: number) =>
      db
        .select()
        .from(playthrough)
        .where(owned(userId, gameId, playthrough))
        .orderBy(playthrough.startedOn, playthrough.id),
  };
}

export const journal = createJournal(db);
