import { and, eq } from "drizzle-orm";
import { type Db, db } from "@/db";
import { journalEntry, statusEvent } from "@/db/schema";

export const STATUSES = ["played", "playing", "backlog", "wishlist"] as const;
export type Status = (typeof STATUSES)[number];

export const COMPLETION_TAGS = [
  "completed",
  "retired",
  "shelved",
  "abandoned",
] as const;
export type CompletionTag = (typeof COMPLETION_TAGS)[number];

/** Tests pass their own database. Every write is scoped to the given user's own entries. */
export function createJournal(db: Db) {
  const owned = (userId: string, gameId: number) =>
    and(eq(journalEntry.userId, userId), eq(journalEntry.gameId, gameId));

  // ponytail: entry write and its event aren't atomic (neon-http has no transactions); a crash between them loses one event.
  const record = (
    userId: string,
    gameId: number,
    status: Status | null,
    completionTag: CompletionTag | null,
    at: Date,
  ) =>
    db
      .insert(statusEvent)
      .values({ userId, gameId, status, completionTag, at });

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
        throw new Error(`Unknown status: ${status}`);
      if (completionTag !== null && !COMPLETION_TAGS.includes(completionTag))
        throw new Error(`Unknown completion tag: ${completionTag}`);
      if (completionTag !== null && status !== "played")
        throw new Error("Only played games get a completion tag.");
      const current = await entry(userId, gameId);
      if (current?.status === status && current.completionTag === completionTag)
        return;
      const updatedAt = new Date();
      await db
        .insert(journalEntry)
        .values({ userId, gameId, status, completionTag, updatedAt })
        .onConflictDoUpdate({
          target: [journalEntry.userId, journalEntry.gameId],
          set: { status, completionTag, updatedAt },
        });
      await record(userId, gameId, status, completionTag, updatedAt);
    },

    /** Takes the game out of the user's journal. */
    async remove(userId: string, gameId: number) {
      const removed = await db
        .delete(journalEntry)
        .where(owned(userId, gameId))
        .returning();
      if (removed.length) await record(userId, gameId, null, null, new Date());
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
  };
}

export const journal = createJournal(db);
