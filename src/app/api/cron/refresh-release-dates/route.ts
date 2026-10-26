import { catalog } from "@/lib/catalog";

/** Daily Vercel Cron (vercel.json): keeps wishlisted games' release dates current. Vercel sends `Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  return Response.json({ refreshed: await catalog.refreshReleaseDates() });
}
