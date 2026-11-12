import { reportOperationalError } from "@/lib/operational-errors";
import { sentryVerificationAllowed } from "@/lib/sentry-verification";

/** Temporary fixed probes only. Remove after acceptance; no database or provider calls. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!sentryVerificationAllowed(request.headers.get("authorization")))
    return new Response(null, { status: 404, headers });
  const kind = request.headers.get("x-sentry-verification-kind");
  if (kind === "route") throw new Error("Sentry verification: route");
  if (kind === "caught") {
    const error = new Error("Sentry verification: caught fallback");
    reportOperationalError("server.route", "unexpected", error);
    reportOperationalError("server.route", "unexpected", error);
    return Response.json({ result: "Caught fallback preserved" }, { headers });
  }
  if (kind === "independent") {
    for (let index = 0; index < 2; index++) {
      reportOperationalError(
        "server.route",
        "unexpected",
        new Error("Sentry verification: independent failure"),
      );
    }
    return Response.json(
      { result: "Two independent failures observed" },
      { headers },
    );
  }
  return new Response(null, { status: 400, headers });
}
