import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { journal } from "@/lib/journal";

/** Signed-in users can't use the app until they've chosen a username. */
export async function proxy(request: NextRequest) {
  const onboarding = request.nextUrl.pathname === "/onboarding";
  // ponytail: one session lookup per navigation; turn on Better Auth's cookieCache if it shows up in latency.
  const session = getSessionCookie(request)
    ? await auth.api.getSession({ headers: request.headers })
    : null;

  if (onboarding && !session) return redirectTo("/sign-in", request);
  if (onboarding && session?.user.username) return redirectTo("/", request);
  if (!onboarding && session && !session.user.username)
    return request.nextUrl.pathname.startsWith("/api/")
      ? Response.json({ error: "Choose a username first." }, { status: 403 })
      : redirectTo("/onboarding", request);
  const username = request.nextUrl.pathname.match(/^\/u\/([^/]+)\/?$/)?.[1];
  if (username && !(await journal.hasPublicProfile(username)))
    return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  return NextResponse.next();
}

const redirectTo = (path: string, request: NextRequest) =>
  NextResponse.redirect(new URL(path, request.url));

export const config = {
  // Everything except auth endpoints, Next internals and static files.
  matcher: ["/((?!api/auth|_next|.*\\..*).*)"],
};
