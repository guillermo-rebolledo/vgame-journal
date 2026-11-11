import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { session, user } from "@/db/schema";

export const REVIEW_YEAR = 2026;

export function createReviewInvitation(db: Db, year = REVIEW_YEAR) {
  return {
    async read(userId: string, sessionId: string) {
      const [state] = await db
        .select({
          viewed: user.reviewViewedYear,
          hidden: user.reviewHiddenYear,
          dismissed: session.reviewDismissedYear,
        })
        .from(user)
        .innerJoin(
          session,
          and(eq(session.userId, user.id), eq(session.id, sessionId)),
        )
        .where(eq(user.id, userId));
      return {
        visible: !!state && state.hidden !== year && state.dismissed !== year,
        viewed: state?.viewed === year,
      };
    },
    async viewed(userId: string) {
      const changed = await db
        .update(user)
        .set({ reviewViewedYear: year })
        .where(
          and(
            eq(user.id, userId),
            or(isNull(user.reviewViewedYear), lt(user.reviewViewedYear, year)),
          ),
        )
        .returning({ id: user.id });
      return changed.length > 0;
    },
    async dismiss(userId: string, sessionId: string) {
      await db
        .update(session)
        .set({
          // A banner choice must not refresh the authentication session's timestamp.
          updatedAt: sql`${session.updatedAt}`,
          reviewDismissedYear: sql`greatest(${session.reviewDismissedYear}, ${year})`,
        })
        .where(and(eq(session.id, sessionId), eq(session.userId, userId)));
    },
    async hide(userId: string) {
      await db
        .update(user)
        .set({
          reviewHiddenYear: sql`greatest(${user.reviewHiddenYear}, ${year})`,
        })
        .where(eq(user.id, userId));
    },
  };
}

export const reviewInvitation = createReviewInvitation(db);
