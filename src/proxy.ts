import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authPageHref, safeReturnTo } from "@/lib/auth-continuation";
import { journal } from "@/lib/journal";
import { lists } from "@/lib/lists";

/** Signed-in users can't use the app until they've chosen a username. */
async function route(request: NextRequest) {
  const onboarding = request.nextUrl.pathname === "/onboarding";
  // ponytail: one session lookup per navigation; turn on Better Auth's cookieCache if it shows up in latency.
  const session = getSessionCookie(request)
    ? await auth.api.getSession({ headers: request.headers })
    : null;

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  if (onboarding && !session)
    return redirectTo(authPageHref("/sign-in", returnTo), request);
  if (onboarding && session?.user.username)
    return redirectTo(returnTo, request);
  if (!onboarding && session && !session.user.username)
    return request.nextUrl.pathname.startsWith("/api/")
      ? Response.json({ error: "Choose a username first." }, { status: 403 })
      : redirectTo(
          authPageHref(
            "/onboarding",
            /^\/(?:sign-in|sign-up|forgot-password|reset-password)(?:\/|$)/.test(
              request.nextUrl.pathname,
            )
              ? returnTo
              : `${request.nextUrl.pathname}${request.nextUrl.search}`,
          ),
          request,
        );
  const publicList = request.nextUrl.pathname.match(
    /^\/u\/([^/]+)\/lists\/([^/]+)(?:\/opengraph-image)?\/?$/,
  );
  if (publicList) {
    let username = "";
    let id = "";
    try {
      username = decodeURIComponent(publicList[1]);
      id = decodeURIComponent(publicList[2]);
    } catch {
      return missing(request);
    }
    try {
      if (!(await lists.hasPublicList(username, id))) return missing(request);
    } catch {
      // Let the page report a temporary failure with retry, rather than a false 404.
    }
  }
  const segment = request.nextUrl.pathname.match(
    /^\/u\/([^/]+)(?:\/opengraph-image(?:\/[^/]+)?)?\/?$/,
  )?.[1];
  if (segment) {
    let username: string;
    try {
      username = decodeURIComponent(segment);
    } catch {
      username = "";
    }
    if (
      !username ||
      !(await journal.hasProfileForViewer(username, session?.user.id ?? null))
    )
      return missing(request);
  }
  return NextResponse.next();
}

const missing = (request: NextRequest) =>
  NextResponse.rewrite(new URL("/404", request.url), { status: 404 });

const redirectTo = (path: string, request: NextRequest) =>
  NextResponse.redirect(new URL(path, request.url));

export const config = {
  // All profile paths, plus everything except auth endpoints, Next internals and static files.
  matcher: ["/lists/:path*", "/u/:path*", "/((?!api/auth|_next|.*\\..*).*)"],
};

/** Visibility-sensitive documents, Flight payloads, errors and redirects must not persist. */
export async function proxy(request: NextRequest) {
  const response = await route(request);
  if (/^\/(?:lists|u)(?:\/|$)/.test(request.nextUrl.pathname))
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
