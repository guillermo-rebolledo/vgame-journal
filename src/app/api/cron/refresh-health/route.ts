import { catalog } from "@/lib/catalog";
import {
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";

/** Protected, persisted evidence only: never calls the game provider or resets baseline age. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  try {
    const health = await catalog.refreshHealth();
    if (!health.healthy)
      reportOperationalError("refresh.health", "unavailable");
    return Response.json(health, {
      status: health.healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    reportOperationalError("refresh.health", operationalCode(error), error);
    return Response.json(
      { healthy: false, code: "refresh_health_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
