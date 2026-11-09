import { db } from "@/db";
import { currentSession } from "@/lib/auth";
import { createSteamOpenId } from "@/lib/steam-openid";
import { steamImportEnabled } from "@/lib/steam-server";

export async function GET() {
  const session = await currentSession();
  const origin = process.env.BETTER_AUTH_URL ?? "";
  if (!session) return Response.redirect(new URL("/sign-in", origin));
  if (!steamImportEnabled())
    return Response.redirect(new URL("/settings?steam=unavailable", origin));
  try {
    const url = await createSteamOpenId(db, origin).start({
      userId: session.user.id,
      sessionId: session.session.id,
    });
    return Response.redirect(url);
  } catch {
    return Response.redirect(new URL("/settings?steam=failed", origin));
  }
}
