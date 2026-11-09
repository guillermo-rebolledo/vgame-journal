import { db } from "@/db";
import { currentSession } from "@/lib/auth";
import { createSteamOpenId } from "@/lib/steam-openid";
import { steamImport, steamImportEnabled } from "@/lib/steam-server";

export async function GET(request: Request) {
  const origin = process.env.BETTER_AUTH_URL ?? "";
  try {
    const session = await currentSession();
    if (!session || !(await steamImportEnabled()))
      throw new Error("Steam connection unavailable");
    const steamId = await createSteamOpenId(db, origin).verify(
      { userId: session.user.id, sessionId: session.session.id },
      new URL(request.url).searchParams,
    );
    await steamImport.link(session.user.id, steamId);
    return Response.redirect(new URL("/settings?steam=connected", origin));
  } catch {
    return Response.redirect(new URL("/settings?steam=failed", origin));
  }
}
