import { and, eq, gt } from "drizzle-orm";
import type { Db } from "@/db";
import { verification } from "@/db/schema";

import {
  DELETION_WINDOW_MS,
  deletionProofId,
} from "./account-security-constants";

export { DELETION_CALLBACK } from "./account-security-constants";

/** Proofs are purpose/account/session bound, never sent to the browser or analytics. */
export function createAccountSecurity(db: Db) {
  return {
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
      await db
        .delete(verification)
        .where(eq(verification.id, deletionProofId(sessionId)));
    },
    async ready(userId: string, sessionId: string) {
      const rows = await db
        .select({ id: verification.id })
        .from(verification)
        .where(
          and(
            eq(verification.id, deletionProofId(sessionId)),
            eq(verification.value, userId),
            gt(verification.expiresAt, new Date()),
          ),
        );
      return rows.length === 1;
    },
  };
}
