import { createHash, randomInt } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { executeBatch } from "@/db/batch";
import { session, user, verification } from "@/db/schema";
import {
  DELETION_WINDOW_MS,
  deletionProofId,
} from "./account-security-constants";
import type { Email } from "./email";

const codeId = (sessionId: string) => `account-deletion-code:${sessionId}`;
const hashCode = (code: string) =>
  createHash("sha256").update(code).digest("hex");
const codeError = {
  error: "Could not confirm the code. Request a new code or try again.",
};

/** Proofs are purpose/account/session bound, never sent to the browser or analytics. */
export function createAccountSecurity(db: Db) {
  return {
    async sendCode(
      userId: string,
      sessionId: string,
      sendEmail: (email: Email) => Promise<void>,
    ) {
      try {
        const [recipient] = await db
          .select({ email: user.email })
          .from(user)
          .innerJoin(session, eq(session.userId, user.id))
          .where(
            and(
              eq(user.id, userId),
              eq(user.emailVerified, true),
              eq(session.id, sessionId),
              gt(session.expiresAt, new Date()),
            ),
          );
        if (!recipient)
          return { error: "Could not send confirmation. Please try again." };
        // Shared per-account budget survives cancellation, expiry and session changes.
        const budget = `account-deletion-send:${userId}`;
        const reserved = await executeBatch(db, [
          sql`select ${user.id} from ${user} where ${user.id} = ${userId} for update`,
          sql`insert into ${verification} (id, identifier, value, expires_at)
            values (${budget}, ${budget}, '1', now() + interval '1 hour')
            on conflict (id) do update set
              value = case when verification.expires_at <= now() then '1' else (verification.value::int + 1)::text end,
              expires_at = case when verification.expires_at <= now() then now() + interval '1 hour' else verification.expires_at end
            where verification.expires_at <= now() or verification.value::int < 3 returning id`,
        ]);
        if (!reserved.length)
          return {
            error: "Confirmation limit reached. Please try again in an hour.",
          };
        const code = randomInt(0, 100_000_000).toString().padStart(8, "0");
        const hash = hashCode(code);
        const id = codeId(sessionId);
        await db
          .delete(verification)
          .where(eq(verification.id, deletionProofId(sessionId)));
        const value = JSON.stringify({
          userId,
          hash,
          attempts: 0,
          delivered: false,
        });
        const expiresAt = new Date(Date.now() + DELETION_WINDOW_MS);
        await db
          .insert(verification)
          .values({
            id,
            identifier: id,
            value,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: verification.id,
            set: { value, expiresAt },
          });
        await sendEmail({
          to: recipient.email,
          subject: "Confirm account deletion for shelve.games",
          text: `Your account deletion code: ${code}\n\nEnter this code in the Settings session where you requested it within five minutes, then type DELETE. This email does not delete your account. If you did not request this, ignore it.`,
        });
        await db.execute(
          sql`update ${verification} set value = jsonb_set(value::jsonb, '{delivered}', 'true')::text where id = ${id} and value::jsonb->>'hash' = ${hash}`,
        );
        return { sent: true as const };
      } catch {
        return { error: "Could not send confirmation. Please try again." };
      }
    },
    async confirmCode(userId: string, sessionId: string, code: string) {
      try {
        const id = codeId(sessionId);
        const proof = deletionProofId(sessionId);
        const rows = await executeBatch(db, [
          // Cancellation locks the same stable row before taking a fresh write snapshot.
          sql`select ${session.id} from ${session} where ${session.id} = ${sessionId} and ${session.userId} = ${userId} for update`,
          sql`update ${verification} set value = jsonb_set(value::jsonb, '{attempts}', to_jsonb((value::jsonb->>'attempts')::int + 1))::text
            where id = ${id} and value::jsonb->>'userId' = ${userId}`,
          sql`with consumed as (
            delete from ${verification} where id = ${id} and expires_at > now()
              and value::jsonb->>'userId' = ${userId} and value::jsonb->>'hash' = ${hashCode(code)}
              and (value::jsonb->>'attempts')::int <= 5 and (value::jsonb->>'delivered')::boolean
              and exists (select 1 from ${session} join ${user} on ${user.id} = ${session.userId}
                where ${session.id} = ${sessionId} and ${session.userId} = ${userId} and ${session.expiresAt} > now() and ${user.emailVerified})
            returning expires_at
          ) insert into ${verification} (id, identifier, value, expires_at)
            select ${proof}, ${proof}, ${userId}, expires_at from consumed
            on conflict (id) do update set value = excluded.value, expires_at = excluded.expires_at returning id`,
        ]);
        return rows.length ? { verified: true as const } : codeError;
      } catch {
        return codeError;
      }
    },
    async issue(userId: string, sessionId: string, startedAt = Date.now()) {
      const id = deletionProofId(sessionId);
      const expiresAt = new Date(startedAt + DELETION_WINDOW_MS);
      if (expiresAt.getTime() <= Date.now()) return;
      await db
        .insert(verification)
        .values({ id, identifier: id, value: userId, expiresAt })
        .onConflictDoUpdate({
          target: verification.id,
          set: { value: userId, expiresAt },
        });
    },
    async cancel(sessionId: string) {
      await executeBatch(db, [
        sql`select ${session.id} from ${session} where ${session.id} = ${sessionId} for update`,
        sql`delete from ${verification} where id in (${deletionProofId(sessionId)}, ${codeId(sessionId)}) returning id`,
      ]);
    },
    async ready(userId: string, sessionId: string) {
      const rows = await db
        .select({ id: verification.id })
        .from(verification)
        .innerJoin(session, eq(session.id, sessionId))
        .where(
          and(
            eq(verification.id, deletionProofId(sessionId)),
            eq(verification.value, userId),
            eq(session.userId, userId),
            gt(session.expiresAt, new Date()),
            gt(verification.expiresAt, new Date()),
          ),
        );
      return rows.length === 1;
    },
  };
}
