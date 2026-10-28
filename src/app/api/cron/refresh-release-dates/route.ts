import { catalog } from "@/lib/catalog";

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
  if (!(await catalog.claimScheduledRefresh()))
    return Response.json({ skipped: true });
  const [wishlist, discovery] = await Promise.allSettled([
    catalog.refreshReleaseDates(),
    catalog.refreshDiscovery(),
  ]);
  if (wishlist.status === "rejected")
    console.error("Wishlist release-date refresh failed");
  if (discovery.status === "rejected")
    console.error("Discovery refresh failed");
  return Response.json({
    checked: wishlist.status === "fulfilled" ? wishlist.value : "failed",
    discovery: discovery.status === "fulfilled" ? discovery.value : "failed",
  });
}
