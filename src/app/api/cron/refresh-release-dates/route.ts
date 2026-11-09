import { randomUUID } from "node:crypto";
import { catalog } from "@/lib/catalog";
import { refreshEvent } from "@/lib/refresh-state";

export const maxDuration = 180;

/**
 * Deployment: apply migrations, then invoke this protected endpoint once to seed discovery.
 * Home reads snapshots only; absent/empty snapshots intentionally omit shelves.
 * Daily Vercel Cron (vercel.json) refreshes Wishlist dates and discovery.
 * Vercel sends `Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  try {
    const result = await catalog.runScheduledRefresh();
    return Response.json(result, {
      status:
        result.outcome === "partial" || result.outcome === "failure"
          ? 503
          : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    refreshEvent("daily", "failure", randomUUID());
    return Response.json(
      { outcome: "failure", code: "refresh_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
