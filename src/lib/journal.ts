import { randomBytes } from "node:crypto";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import {
  game,
  journalEntry,
  playthrough,
  releaseDate,
  statusEvent,
  user,
  verification,
} from "@/db/schema";
import { calendarFeed } from "@/lib/calendar-feed";
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
import { createLists } from "@/lib/lists";
import {
  compareWishlist,
  REGIONS,
  type Region,
  type ResolvedRelease,
  resolveRelease,
} from "@/lib/release-dates";

export {
  COMPLETION_TAGS,
  type CompletionTag,
  STATUSES,
  type Status,
} from "@/lib/library";

/** A wishlisted game with its release resolved for the user's region. */
export type WishlistEntry = {
  gameId: number;
  title: string;
  slug: string;
  coverImageId: string | null;
  release: ResolvedRelease;
};

/** A broken Journal rule. Its message is safe to show the user. */
export class JournalError extends Error {}

/** Below this many Ratings a game's Community rating has no average. */
export const COMMUNITY_RATING_THRESHOLD = 5;

export type RatingSummary = {
  count: number;
  /** Stars to one decimal (rounded half up), or null with no Ratings or, for a Community rating, below the threshold. */
  average: number | null;
  /** Ratings per points value: `distribution[points - 1]`. */
  distribution: number[];
};

/** Count, average and distribution from Ratings grouped by points, in integer arithmetic. */
function summarizeRatings(
  rows: { points: number | null; ratings: number }[],
  threshold = 1,
): RatingSummary {
  const distribution = Array<number>(10).fill(0);
  let count = 0;
  let points = 0;
  for (const row of rows) {
    if (row.points === null) continue;
    distribution[row.points - 1] = row.ratings;
    count += row.ratings;
    points += row.points * row.ratings;
  }
  // Tenths of a star = points × 5 ÷ count, rounded half up without float accumulation.
  const average =
    count >= threshold && count > 0
      ? Math.floor((points * 10 + count) / (2 * count)) / 10
      : null;
  return { count, average, distribution };
}

export type JournalRemovalConfirmation = {
  confirmationRequired: true;
  playthroughCount: number;
  /** Removal also deletes the entry's Rating. */
  rated: boolean;
};

/** What a user fills in for a Playthrough. Dates are `YYYY-MM-DD`. */
export type PlaythroughInput = {
  platform: string;
  startedOn: string;
  endedOn?: string | null;
  hours?: number | null;
  notes?: string;
};

/** Rating points: whole half stars, 1 (half a star) to 10 (5 stars). */
const isRatingPoints = (points: unknown): points is number =>
  Number.isInteger(points) &&
  (points as number) >= 1 &&
  (points as number) <= 10;

/** A Rating can only be given (not just kept) in these Statuses. */
const RATEABLE_STATUSES: Status[] = ["played", "playing"];

function isDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  // Unparseable months/days are NaN; Feb 30 parses but rolls over to March.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

/** Index related rows once instead of scanning the full collection for every game. */
function byGame<T extends { gameId: number }>(rows: T[]) {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.gameId);
    if (group) group.push(row);
    else grouped.set(row.gameId, [row]);
  }
  return grouped;
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

  /** Ratings per points value among the matching rated entries. One grouped query over the partial rating index. */
  const ratingsByPoints = (where: SQL) =>
    db
      .select({
        points: journalEntry.rating,
        ratings: sql<number>`count(*)`.mapWith(Number),
      })
      .from(journalEntry)
      .where(and(where, sql`${journalEntry.rating} is not null`))
      .groupBy(journalEntry.rating);

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

  async function region(userId: string): Promise<Region> {
    const [found] = await db
      .select({ region: user.region })
      .from(user)
      .where(eq(user.id, userId));
    return found?.region ?? "earliest";
  }

  /** The user's Wishlist: exact releases soonest first, then imprecise ones, then TBA. */
  async function wishlist(userId: string): Promise<WishlistEntry[]> {
    const [games, userRegion] = await Promise.all([
      db
        .select({
          gameId: game.id,
          title: game.title,
          slug: game.slug,
          coverImageId: game.coverImageId,
        })
        .from(journalEntry)
        .innerJoin(game, eq(game.id, journalEntry.gameId))
        .where(
          and(
            eq(journalEntry.userId, userId),
            eq(journalEntry.status, "wishlist"),
          ),
        ),
      region(userId),
    ]);
    if (!games.length) return [];
    const dates = await db
      .select()
      .from(releaseDate)
      .where(
        inArray(
          releaseDate.gameId,
          games.map((g) => g.gameId),
        ),
      );
    const datesByGame = byGame(dates);
    return games
      .map((g) => ({
        ...g,
        release: resolveRelease(datesByGame.get(g.gameId) ?? [], userRegion),
      }))
      .sort(compareWishlist);
  }

  /** Replaces the user's feed token, so URLs with the old one stop working. */
  async function regenerateFeedToken(userId: string) {
    const feedToken = randomBytes(24).toString("base64url");
    await db.update(user).set({ feedToken }).where(eq(user.id, userId));
    return feedToken;
  }

  return {
    /** One statement also removes reset tokens, which have no user foreign key. */
    async deleteAccount(userId: string, confirmation: unknown) {
      if (confirmation !== "DELETE")
        throw new JournalError("Type DELETE to confirm account deletion.");
      await db.execute(sql`
        with deleted_user as (
          delete from ${user} where ${user.id} = ${userId} returning ${user.id}
        )
        delete from ${verification}
        where ${verification.value} in (select id from deleted_user)
          and ${verification.identifier} like 'reset-password:%'
      `);
    },

    /** A portable copy of the whole journal, including private notes, without auth secrets. */
    async exportData(userId: string) {
      const [profile] = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          username: user.username,
          displayUsername: user.displayUsername,
          region: user.region,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, userId));
      if (!profile) throw new JournalError("User not found.");
      const [entries, statusHistory, playthroughs, lists] = await Promise.all([
        db
          .select({
            gameId: journalEntry.gameId,
            title: game.title,
            slug: game.slug,
            status: journalEntry.status,
            completionTag: journalEntry.completionTag,
            rating: journalEntry.rating,
            ratedAt: journalEntry.ratedAt,
            createdAt: journalEntry.createdAt,
            updatedAt: journalEntry.updatedAt,
          })
          .from(journalEntry)
          .innerJoin(game, eq(game.id, journalEntry.gameId))
          .where(eq(journalEntry.userId, userId))
          .orderBy(journalEntry.createdAt, journalEntry.gameId),
        db
          .select()
          .from(statusEvent)
          .where(eq(statusEvent.userId, userId))
          .orderBy(statusEvent.at, statusEvent.id),
        db
          .select()
          .from(playthrough)
          .where(eq(playthrough.userId, userId))
          .orderBy(playthrough.startedOn, playthrough.id),
        createLists(db).ownerCollection(userId),
      ]);
      return { profile, entries, statusHistory, playthroughs, lists };
    },

    /** Fast route check before streaming, so unknown profiles get an HTTP 404. */
    async hasPublicProfile(username: string) {
      const [found] = await db
        .select({ username: user.username })
        .from(user)
        .where(eq(user.username, username.toLowerCase()));
      return !!found;
    },

    /** Public allowlist: never select notes, email, auth fields or the calendar token. */
    async publicProfile(username: string) {
      const [owner] = await db
        .select({ id: user.id, username: user.username, image: user.image })
        .from(user)
        .where(eq(user.username, username.toLowerCase()));
      if (!owner) return null;
      const [library, wishlistEntries, stats, playthroughs] = await Promise.all(
        [
          this.library(owner.id),
          wishlist(owner.id),
          this.stats(owner.id),
          db
            .select({
              gameId: playthrough.gameId,
              platform: playthrough.platform,
              startedOn: playthrough.startedOn,
              endedOn: playthrough.endedOn,
              hours: playthrough.hours,
            })
            .from(playthrough)
            .where(eq(playthrough.userId, owner.id))
            .orderBy(playthrough.startedOn, playthrough.id),
        ],
      );
      return {
        username: owner.username,
        image: owner.image,
        library,
        wishlist: wishlistEntries,
        stats,
        playthroughs,
      };
    },

    /** Games count once per end-date year; only entries currently marked Played qualify. */
    async stats(userId: string) {
      const [finishedPerYear, hoursByPlatform, events, ratings] =
        await Promise.all([
          db
            .select({
              year: sql<number>`extract(year from ${playthrough.endedOn})`.mapWith(
                Number,
              ),
              games: sql<number>`count(distinct ${playthrough.gameId})`.mapWith(
                Number,
              ),
            })
            .from(playthrough)
            .innerJoin(
              journalEntry,
              and(
                eq(journalEntry.userId, playthrough.userId),
                eq(journalEntry.gameId, playthrough.gameId),
              ),
            )
            .where(
              and(
                eq(playthrough.userId, userId),
                eq(journalEntry.status, "played"),
                sql`${playthrough.endedOn} is not null`,
              ),
            )
            .groupBy(sql`extract(year from ${playthrough.endedOn})`)
            .orderBy(sql`extract(year from ${playthrough.endedOn})`),
          db
            .select({
              platform: playthrough.platform,
              hours: sql<number>`sum(${playthrough.hours})`.mapWith(Number),
            })
            .from(playthrough)
            .where(
              and(
                eq(playthrough.userId, userId),
                sql`${playthrough.hours} is not null`,
              ),
            )
            .groupBy(playthrough.platform)
            .orderBy(sql`sum(${playthrough.hours}) desc`, playthrough.platform),
          db
            .select({
              gameId: statusEvent.gameId,
              status: statusEvent.status,
              at: statusEvent.at,
            })
            .from(statusEvent)
            .where(eq(statusEvent.userId, userId))
            .orderBy(statusEvent.at, statusEvent.id),
          ratingsByPoints(eq(journalEntry.userId, userId)),
        ]);
      const backlog = new Set<number>();
      const days = new Map<string, number>();
      for (const event of events) {
        if (event.status === "backlog") backlog.add(event.gameId);
        else backlog.delete(event.gameId);
        days.set(event.at.toISOString().slice(0, 10), backlog.size);
      }
      const backlogOverTime = Array.from(days, ([day, games]) => ({
        day,
        games,
      }));
      return {
        finishedPerYear,
        hoursByPlatform,
        backlogOverTime,
        ratings: summarizeRatings(ratings),
      };
    },

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

    /**
     * Changes the status only if the entry is still as the caller saw it: in `from.status`, and, given `from.updatedAt`, untouched since then.
     * Returns the change's time (pass it back to undo), or null if the entry had changed. One conditional UPDATE, so racing writes can't both win.
     */
    async move(
      userId: string,
      gameId: number,
      from: { status: Status; updatedAt?: Date },
      to: Status,
    ) {
      if (!STATUSES.includes(to))
        throw new JournalError(`Unknown status: ${to}`);
      const updatedAt = new Date();
      const [moved] = await db
        .update(journalEntry)
        .set({ status: to, completionTag: null, updatedAt })
        .where(
          and(
            owned(userId, gameId),
            eq(journalEntry.status, from.status),
            from.updatedAt && eq(journalEntry.updatedAt, from.updatedAt),
          ),
        )
        .returning({ updatedAt: journalEntry.updatedAt });
      if (!moved) return null;
      await recordStatusEvent(userId, gameId, to, null, updatedAt);
      return moved.updatedAt;
    },

    /** Rates a Played or Playing game. One conditional UPDATE, so a racing Status move can't let a Rating land on another Status. */
    async setRating(userId: string, gameId: number, points: unknown) {
      if (!isRatingPoints(points))
        throw new JournalError("Choose a Rating from half a star to 5 stars.");
      const [rated] = await db
        .update(journalEntry)
        // Same value keeps rated-at, so retries are idempotent. Never touch updated-at: `move` uses it as its stale-write guard.
        .set({
          rating: points,
          ratedAt: sql`case when ${journalEntry.rating} = ${points} then ${journalEntry.ratedAt} else ${sql.param(new Date(), journalEntry.ratedAt)} end`,
        })
        .where(
          and(
            owned(userId, gameId),
            inArray(journalEntry.status, RATEABLE_STATUSES),
          ),
        )
        .returning({ rating: journalEntry.rating });
      if (rated) return;
      // Nothing was written; this read only picks the message.
      throw new JournalError(
        (await entry(userId, gameId))
          ? "Mark it Played or Playing to rate it."
          : "This game is not in your Journal.",
      );
    },

    /** Every stored Rating for a game, whatever each entry's Status. Derived, never counted, so it can't drift. */
    async communityRating(gameId: number): Promise<RatingSummary> {
      return summarizeRatings(
        await ratingsByPoints(eq(journalEntry.gameId, gameId)),
        COMMUNITY_RATING_THRESHOLD,
      );
    },

    /** Removes the user's Rating for a game, in any Status. A no-op if there is none. */
    async clearRating(userId: string, gameId: number) {
      await db
        .update(journalEntry)
        .set({ rating: null, ratedAt: null })
        .where(owned(userId, gameId));
    },

    /** Takes the game out of the user's journal. */
    async remove(
      userId: string,
      gameId: number,
      acknowledged: unknown = false,
    ): Promise<JournalRemovalConfirmation | undefined> {
      const removed = await db
        .delete(journalEntry)
        .where(
          and(
            owned(userId, gameId),
            // Guard in the delete itself: stale clients cannot bypass confirmation.
            acknowledged === true
              ? undefined
              : sql`${journalEntry.rating} is null and not exists (select 1 from ${playthrough} where ${playthrough.userId} = ${userId} and ${playthrough.gameId} = ${gameId})`,
          ),
        )
        .returning();
      if (removed.length)
        await recordStatusEvent(userId, gameId, null, null, new Date());
      else {
        const [kept] = await db
          .select({
            rated: sql<boolean>`${journalEntry.rating} is not null`,
            playthroughCount:
              sql<number>`(select count(*) from ${playthrough} where ${playthrough.userId} = ${userId} and ${playthrough.gameId} = ${gameId})`.mapWith(
                Number,
              ),
          })
          .from(journalEntry)
          .where(owned(userId, gameId));
        if (kept) return { confirmationRequired: true, ...kept };
      }
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

    /** Validate before any write; existing membership and completion tags stay intact. */
    async recordPlaythrough(
      userId: string,
      gameId: number,
      input: PlaythroughInput,
      status: Status,
      submissionId: string,
    ) {
      const values = await playthroughValues(gameId, input);
      if (!STATUSES.includes(status))
        throw new JournalError(`Unknown status: ${status}`);
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          submissionId,
        )
      )
        throw new JournalError(
          "Invalid submission. Close the editor and start again.",
        );
      const at = new Date();
      // Concurrent recording must never overwrite membership created by another tab.
      const created = await db
        .insert(journalEntry)
        .values({ userId, gameId, status, createdAt: at, updatedAt: at })
        .onConflictDoNothing({
          target: [journalEntry.userId, journalEntry.gameId],
        })
        .returning();
      // shortcut: these Neon HTTP writes are sequential; a failure can leave membership saved.
      // The form reports this honestly and keeps the same submission ID for safe retries.
      if (created.length)
        await recordStatusEvent(userId, gameId, status, null, at);
      const saved = await db
        .insert(playthrough)
        .values({ userId, gameId, ...values, submissionId })
        .onConflictDoUpdate({
          target: [playthrough.userId, playthrough.submissionId],
          set: values,
          setWhere: eq(playthrough.gameId, gameId),
        })
        .returning({ id: playthrough.id });
      if (!saved.length)
        throw new JournalError(
          "This submission belongs to another game. Cancel and start again.",
        );
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
            rating: journalEntry.rating,
            ratedAt: journalEntry.ratedAt,
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
      const playthroughsByGame = byGame(playthroughs);
      const library = entries.map((entry) => {
        const own = playthroughsByGame.get(entry.gameId) ?? [];
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

    /** The region whose release dates the user's Countdowns follow. */
    region,

    async setRegion(userId: string, region: Region) {
      if (!REGIONS.includes(region))
        throw new JournalError(`Unknown region: ${region}`);
      await db.update(user).set({ region }).where(eq(user.id, userId));
    },

    wishlist,

    /** The secret in the user's calendar feed URL, made on first use. */
    async feedToken(userId: string) {
      const [found] = await db
        .update(user)
        .set({
          feedToken: sql`coalesce(${user.feedToken}, ${randomBytes(24).toString("base64url")})`,
        })
        .where(eq(user.id, userId))
        .returning({ feedToken: user.feedToken });
      if (!found?.feedToken) throw new JournalError("User not found.");
      return found.feedToken;
    },

    regenerateFeedToken,

    /** The iCalendar feed of the Wishlist whose owner has this feed token, or null for an unknown token. */
    async calendarFeed(feedToken: string) {
      if (!feedToken) return null;
      const [owner] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.feedToken, feedToken));
      return owner ? calendarFeed(await wishlist(owner.id)) : null;
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
