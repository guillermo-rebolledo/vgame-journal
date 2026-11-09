import { randomBytes } from "node:crypto";
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { executeBatch } from "@/db/batch";
import {
  game,
  journalEntry,
  playthrough,
  releaseDate,
  session,
  statusEvent,
  user,
  verification,
} from "@/db/schema";
import { deletionProofId } from "@/lib/account-security-constants";
import { calendarFeed } from "@/lib/calendar-feed";
import { ExpectedError } from "@/lib/expected-error";
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
import { observeOperation } from "@/lib/operational-errors";
import { isRatingPoints, RATEABLE_STATUSES } from "@/lib/rating";
import {
  compareWishlist,
  REGIONS,
  type Region,
  type ResolvedRelease,
  resolveRelease,
} from "@/lib/release-dates";

export type ProfileVisibility = "private" | "public";

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
export class JournalError extends ExpectedError {}

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

/** What removing an entry would permanently delete besides the entry itself. */
export type JournalRemovalContents = {
  playthroughCount: number;
  /** Removal also deletes the entry's Rating. */
  rated: boolean;
};

export type JournalRemovalConfirmation = {
  confirmationRequired: true;
} & JournalRemovalContents;

/** Snapshot shown before removal; the server rechecks it under the owner lock. */
export type JournalRemovalSnapshot = {
  updatedAt: Date;
  rating: number | null;
  ratedAt: Date | null;
  playthroughs: (typeof playthrough.$inferSelect)[];
};

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

  // A separate READ COMMITTED statement after this lock sees the previous owner's commit,
  // including when the game has no entry yet. Never combine the lock and reads in one CTE.
  const locked = (userId: string, ...statements: [SQL, ...SQL[]]) =>
    executeBatch(db, [
      sql`select id from ${user} where id = ${userId} for update`,
      ...statements,
    ]);

  const consumeInvitation = (userId: string) => sql`
    update ${user} set first_save_feedback = 'consumed'
    where id = ${userId}
      and first_save_feedback = 'insert:' || pg_current_xact_id()::text
    returning id`;

  // Keep re-additions ordered after removal, including equal/backwards application clocks.
  const nextStatusAt = (userId: string, gameId: number) => sql`
    greatest(${new Date()}::timestamp, (select max(at) + interval '1 millisecond'
      from ${statusEvent} where user_id = ${userId} and game_id = ${gameId}))`;

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

  const operations = {
    /** Consume the proof and cascade deletion atomically; failed statements preserve both. */
    async deleteAccount(
      userId: string,
      confirmation: unknown,
      sessionId?: string,
    ) {
      if (confirmation !== "DELETE")
        throw new JournalError("Type DELETE to confirm account deletion.");
      if (!sessionId)
        throw new JournalError(
          "Confirm your identity again before deleting your account.",
        );
      const result = await db.execute(sql`
        with proof as (
          delete from ${verification}
          where ${verification.id} = ${deletionProofId(sessionId)}
            and ${verification.value} = ${userId}
            and ${verification.expiresAt} > now()
            and exists (select 1 from ${session} where ${session.id} = ${sessionId}
              and ${session.userId} = ${userId} and ${session.expiresAt} > now())
          returning ${verification.value}
        ), deleted_user as (
          delete from ${user} where ${user.id} = ${userId}
            and ${user.id} in (select value from proof) returning ${user.id}
        ), reset_tokens as (
          delete from ${verification}
          where exists (select 1 from deleted_user)
            and ${verification.id} <> ${deletionProofId(sessionId)}
            and ((${verification.value} = ${userId} and
              (${verification.identifier} like 'reset-password:%' or ${verification.identifier} like 'account-deletion:%'))
              or ${verification.id} = ${`account-deletion-send:${userId}`}
              or (case when ${verification.identifier} like 'account-deletion-code:%'
                then ${verification.value}::jsonb->>'userId' end) = ${userId})
        )
        select id from deleted_user
      `);
      const rows = Array.isArray(result)
        ? result
        : (result as { rows: unknown[] }).rows;
      if (!rows.length)
        throw new JournalError(
          "Confirm your identity again before deleting your account.",
        );
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
          profileVisibility: user.profileVisibility,
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
    hasPublicProfile(username: string) {
      return this.hasProfileForViewer(username, null);
    },

    async hasProfileForViewer(username: string, viewerId: string | null) {
      const [found] = await db
        .select({ username: user.username })
        .from(user)
        .where(
          and(
            eq(user.username, username.toLowerCase()),
            or(
              eq(user.profileVisibility, "public"),
              viewerId ? eq(user.id, viewerId) : undefined,
            ),
          ),
        );
      return !!found;
    },

    /** Public allowlist: never select notes, email, auth fields or the calendar token. */
    publicProfile(username: string) {
      return this.profileForViewer(username, null);
    },

    async profileForViewer(username: string, viewerId: string | null) {
      const [owner] = await db
        .select({
          id: user.id,
          username: user.username,
          image: user.image,
          visibility: user.profileVisibility,
        })
        .from(user)
        .where(
          and(
            eq(user.username, username.toLowerCase()),
            or(
              eq(user.profileVisibility, "public"),
              viewerId ? eq(user.id, viewerId) : undefined,
            ),
          ),
        );
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
        visibility: owner.visibility,
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

    /** Adds or changes Status/tag. Returns true only for this request's first-save invitation. */
    async set(
      userId: string,
      gameId: number,
      {
        status,
        completionTag = null,
        preserveCompletionTag = false,
      }: {
        status: Status;
        completionTag?: CompletionTag | null;
        preserveCompletionTag?: boolean;
      },
    ) {
      if (!STATUSES.includes(status))
        throw new JournalError(`Unknown status: ${status}`);
      if (completionTag !== null && !COMPLETION_TAGS.includes(completionTag))
        throw new JournalError(`Unknown completion tag: ${completionTag}`);
      if (completionTag !== null && status !== "played")
        throw new JournalError("Only played games get a completion tag.");
      const at = nextStatusAt(userId, gameId);
      const invitation = await locked(
        userId,
        sql`with changed as (
          insert into ${journalEntry}
            (user_id, game_id, status, completion_tag, created_at, updated_at)
          values (${userId}, ${gameId}, ${status}, ${completionTag}, ${at}, ${at})
          on conflict (user_id, game_id) do update
          set status = excluded.status,
              completion_tag = case when ${preserveCompletionTag} and journal_entry.status = excluded.status
                then journal_entry.completion_tag else excluded.completion_tag end,
              updated_at = greatest(excluded.updated_at, journal_entry.updated_at + interval '1 millisecond')
          where journal_entry.status is distinct from excluded.status
             or (not ${preserveCompletionTag} and journal_entry.completion_tag is distinct from excluded.completion_tag)
          returning user_id, game_id, status, completion_tag, updated_at
        ) insert into ${statusEvent} (user_id, game_id, status, completion_tag, at)
          select user_id, game_id, status, completion_tag, updated_at from changed`,
        consumeInvitation(userId),
      );
      return invitation.length === 1;
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
      const [moved] = await locked(
        userId,
        sql`
        with changed as (
          update ${journalEntry} set status = ${to}, completion_tag = null,
            updated_at = greatest(${new Date()}, updated_at + interval '1 millisecond')
          where user_id = ${userId} and game_id = ${gameId} and status = ${from.status}
            ${from.updatedAt ? sql`and updated_at = ${from.updatedAt}` : sql``}
            and (status is distinct from ${to} or completion_tag is not null)
          returning user_id, game_id, status, updated_at
        ), event as (
          insert into ${statusEvent} (user_id, game_id, status, at)
          select user_id, game_id, status, updated_at from changed
        ) select to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at from changed`,
      );
      return moved
        ? new Date((moved as { updated_at: string }).updated_at)
        : null;
    },

    /** Rates a Played or Playing game. One conditional UPDATE, so a racing Status move can't let a Rating land on another Status. */
    async setRating(userId: string, gameId: number, points: unknown) {
      if (!isRatingPoints(points))
        throw new JournalError("Choose a Rating from half a star to 5 stars.");
      const [rated] = await locked(
        userId,
        db
          .update(journalEntry)
          // Same value keeps rated-at, so retries are idempotent. Never touch updated-at: `move` uses it as its stale-write guard.
          .set({
            rating: points,
            ratedAt: sql`case when ${journalEntry.rating} = ${points} then ${journalEntry.ratedAt} else ${sql.param(new Date(), journalEntry.ratedAt)} end`,
          })
          .where(
            and(
              owned(userId, gameId),
              inArray(journalEntry.status, [...RATEABLE_STATUSES]),
            ),
          )
          .returning({ rating: journalEntry.rating })
          .getSQL(),
      );
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
      await locked(
        userId,
        db
          .update(journalEntry)
          .set({ rating: null, ratedAt: null })
          .where(owned(userId, gameId))
          .getSQL(),
      );
    },

    /** Takes the game out of the user's journal. */
    async remove(
      userId: string,
      gameId: number,
      acknowledged: unknown = false,
      expected?: JournalRemovalSnapshot,
    ): Promise<JournalRemovalConfirmation | undefined> {
      const details = expected?.playthroughs
        .map(({ id, platform, startedOn, endedOn, hours, notes }) => ({
          id,
          platform,
          startedOn,
          endedOn,
          hours,
          notes,
        }))
        .sort((a, b) => a.id - b.id);
      const unchanged = expected
        ? sql`
        updated_at = ${expected.updatedAt}
        and rating is not distinct from ${expected.rating}::smallint
        and rated_at is not distinct from ${expected.ratedAt}::timestamp
        and (select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'platform', platform, 'startedOn', started_on::text,
          'endedOn', ended_on::text, 'hours', hours, 'notes', notes
        ) order by id), '[]'::jsonb) from ${playthrough}
          where user_id = ${userId} and game_id = ${gameId}) = ${JSON.stringify(details)}::jsonb
      `
        : sql`true`;
      const [kept] = await locked(
        userId,
        sql`
        with current as materialized (
          select *, rating is not null as rated,
            (select count(*)::int from ${playthrough} where user_id = ${userId} and game_id = ${gameId}) as "playthroughCount",
            (${unchanged}) as unchanged
          from ${journalEntry} where user_id = ${userId} and game_id = ${gameId}
        ), removed as (
          delete from ${journalEntry} where user_id = ${userId} and game_id = ${gameId}
            and exists (select 1 from current where unchanged
              and (${acknowledged === true} or (not rated and "playthroughCount" = 0)))
          returning user_id, game_id, updated_at
        ), event as (
          insert into ${statusEvent} (user_id, game_id, status, at)
          select user_id, game_id, null, greatest(${new Date()}, updated_at + interval '1 millisecond') from removed
        ) select rated, "playthroughCount" from current where not exists (select 1 from removed)`,
      );
      if (kept)
        return {
          confirmationRequired: true,
          ...(kept as JournalRemovalContents),
        };
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
      const values = await playthroughValues(gameId, input);
      const saved = await locked(
        userId,
        sql`
        insert into ${playthrough} (user_id, game_id, platform, started_on, ended_on, hours, notes)
        select ${userId}, ${gameId}, ${values.platform}, ${values.startedOn}::date,
          ${values.endedOn}::date, ${values.hours}::numeric, ${values.notes}
        from ${journalEntry} where user_id = ${userId} and game_id = ${gameId}
        returning id`,
      );
      if (!saved.length)
        throw new JournalError("This game is not in your journal.");
    },

    /** Validates before writing and preserves membership/tags. Returns this request’s first-save invitation. */
    async recordPlaythrough(
      userId: string,
      gameId: number,
      input: PlaythroughInput,
      status: Status,
      submissionId: string,
      requireMembership = false,
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
      const at = nextStatusAt(userId, gameId);
      const compatible = sql`not exists (select 1 from ${playthrough}
        where user_id = ${userId} and submission_id = ${submissionId}::uuid and game_id <> ${gameId})`;
      const [result] = await locked(
        userId,
        sql`with inserted as (
          insert into ${journalEntry} (user_id, game_id, status, created_at, updated_at)
          select ${userId}, ${gameId}, ${status}, ${at}, ${at} where ${compatible} and ${!requireMembership}
          on conflict (user_id, game_id) do nothing returning user_id, game_id, status, updated_at
        ) insert into ${statusEvent} (user_id, game_id, status, at)
          select user_id, game_id, status, updated_at from inserted`,
        sql`insert into ${playthrough}
          (user_id, game_id, platform, started_on, ended_on, hours, notes, submission_id)
          select ${userId}, ${gameId}, ${values.platform}, ${values.startedOn}::date,
            ${values.endedOn}::date, ${values.hours}::numeric, ${values.notes}, ${submissionId}::uuid
          where ${compatible} and exists (select 1 from ${journalEntry} where user_id = ${userId} and game_id = ${gameId})
          on conflict (user_id, submission_id) do update set
            platform = excluded.platform, started_on = excluded.started_on,
            ended_on = excluded.ended_on, hours = excluded.hours, notes = excluded.notes
          where playthrough.game_id = excluded.game_id`,
        sql`with invitation as (${consumeInvitation(userId)})
          select ${compatible} as compatible, exists(select 1 from invitation) as invited,
            exists(select 1 from ${journalEntry} where user_id = ${userId} and game_id = ${gameId}) as present`,
      );
      const saved = result as {
        compatible: boolean;
        invited: boolean;
        present: boolean;
      };
      if (!saved.compatible)
        throw new JournalError(
          "This submission belongs to another game. Cancel and start again.",
        );
      if (!saved.present)
        throw new JournalError(
          "This game is no longer in your Journal. Your draft is still here. Save the game again before retrying.",
        );
      return saved.invited;
    },

    /** Replaces the details of one of the user's playthroughs. Others' are left alone. */
    async updatePlaythrough(
      userId: string,
      id: number,
      input: PlaythroughInput,
      expectedGameId?: number,
    ) {
      const [found] = await db
        .select({ gameId: playthrough.gameId })
        .from(playthrough)
        .where(ownedPlaythrough(userId, id));
      if (!found) {
        if (expectedGameId !== undefined)
          throw new JournalError(
            "This Playthrough is no longer available. Your draft is still here.",
          );
        return;
      }
      if (expectedGameId !== undefined && found.gameId !== expectedGameId)
        throw new JournalError("This Playthrough belongs to another game.");
      const values = await playthroughValues(found.gameId, input);
      const saved = await locked(
        userId,
        db
          .update(playthrough)
          .set(values)
          .where(ownedPlaythrough(userId, id))
          .returning({ id: playthrough.id })
          .getSQL(),
      );
      if (!saved.length && expectedGameId !== undefined)
        throw new JournalError(
          "This Playthrough is no longer available. Your draft is still here.",
        );
    },

    /** Deletes one of the user's playthroughs. Others' are left alone. */
    async removePlaythrough(userId: string, id: number) {
      await locked(
        userId,
        db.delete(playthrough).where(ownedPlaythrough(userId, id)).getSQL(),
      );
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

    async profileVisibility(userId: string): Promise<ProfileVisibility> {
      const [found] = await db
        .select({ visibility: user.profileVisibility })
        .from(user)
        .where(eq(user.id, userId));
      return found?.visibility ?? "private";
    },

    async setProfileVisibility(userId: string, visibility: unknown) {
      if (visibility !== "private" && visibility !== "public")
        throw new JournalError("Choose Public or Private profile visibility.");
      await db
        .update(user)
        .set({ profileVisibility: visibility })
        .where(eq(user.id, userId));
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
  const expected = (error: unknown) => error instanceof JournalError;
  return {
    ...operations,
    set: observeOperation("journal.set", operations.set, expected),
    move: observeOperation("journal.move", operations.move, expected),
    setRating: observeOperation(
      "journal.setRating",
      operations.setRating,
      expected,
    ),
    clearRating: observeOperation(
      "journal.clearRating",
      operations.clearRating,
      expected,
    ),
    remove: observeOperation("journal.remove", operations.remove, expected),
    addPlaythrough: observeOperation(
      "journal.addPlaythrough",
      operations.addPlaythrough,
      expected,
    ),
    recordPlaythrough: observeOperation(
      "journal.recordPlaythrough",
      operations.recordPlaythrough,
      expected,
    ),
    updatePlaythrough: observeOperation(
      "journal.updatePlaythrough",
      operations.updatePlaythrough,
      expected,
    ),
    removePlaythrough: observeOperation(
      "journal.removePlaythrough",
      operations.removePlaythrough,
      expected,
    ),
    setRegion: observeOperation(
      "journal.setRegion",
      operations.setRegion,
      expected,
    ),
    feedToken: observeOperation(
      "journal.feedToken",
      operations.feedToken,
      expected,
    ),
    regenerateFeedToken: observeOperation(
      "journal.regenerateFeedToken",
      operations.regenerateFeedToken,
      expected,
    ),
    deleteAccount: observeOperation(
      "journal.deleteAccount",
      operations.deleteAccount,
      expected,
    ),
  };
}

export const journal = createJournal(db);
