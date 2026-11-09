import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { refreshTask } from "@/db/schema";
import { reportRefreshEvent as refreshEvent } from "@/lib/operational-errors";

export { reportRefreshEvent as refreshEvent } from "@/lib/operational-errors";

const DAILY_TASKS = ["wishlist", "recent", "popular"] as const;
const FRESHNESS_MS = 30 * 60 * 60 * 1000;
type Outcome = "success" | "partial" | "failure";

export function createRefreshState(db: Db) {
  return {
    async run<T>(
      key: string,
      work: () => Promise<T>,
      outcome: (value: T) => Outcome = () => "success",
    ) {
      const startedAt = new Date();
      const correlationId = randomUUID();
      await db
        .update(refreshTask)
        .set({
          attemptedAt: startedAt,
          startedAt,
          finishedAt: null,
          outcome: "running",
        })
        .where(eq(refreshTask.key, key));
      refreshEvent(key, "running", correlationId);
      try {
        const value = await work();
        const status = outcome(value);
        const finishedAt = new Date();
        await db
          .update(refreshTask)
          .set({
            finishedAt,
            outcome: status,
            ...(status === "success" ? { lastSuccessAt: finishedAt } : {}),
          })
          .where(eq(refreshTask.key, key));
        refreshEvent(key, status, correlationId);
        return value;
      } catch (error) {
        await db
          .update(refreshTask)
          .set({ finishedAt: new Date(), outcome: "failure" })
          .where(eq(refreshTask.key, key));
        refreshEvent(key, "failure", correlationId);
        throw error;
      }
    },
    async skipped() {
      await db
        .update(refreshTask)
        .set({ lastSkippedAt: new Date() })
        .where(eq(refreshTask.key, "daily"));
      refreshEvent("daily", "skipped", randomUUID());
    },
    async health(now = new Date()) {
      const rows = await db.select().from(refreshTask);
      const tasks = DAILY_TASKS.map((key) => {
        const row = rows.find((row) => row.key === key);
        // A missing migration baseline is unhealthy rather than silently resetting its grace period.
        const baseline = row?.lastSuccessAt ?? row?.enabledAt;
        const stale =
          !baseline || now.getTime() - baseline.getTime() >= FRESHNESS_MS;
        return {
          ...row,
          key,
          freshness: stale
            ? "stale"
            : row?.lastSuccessAt
              ? "healthy"
              : "pending",
        };
      });
      return {
        healthy: tasks.every((task) => task.freshness !== "stale"),
        evaluatedAt: now,
        thresholdHours: 30,
        tasks,
        invocation: rows.find((row) => row.key === "daily"),
      };
    },
  };
}
