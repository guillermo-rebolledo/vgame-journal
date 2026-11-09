import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

export const maxDuration = 15;

/** Cheap readiness only: no provider calls, user records or configuration in the response. */
export async function GET() {
  await connection();
  try {
    // The production database transport aborts each request after ten seconds.
    await db.execute(sql`select 1`);
    return Response.json(
      { status: "ok", service: "shelve.games", version: 1 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
