import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sentryVerificationAllowed } from "@/lib/sentry-verification";

export const metadata = { robots: { index: false, follow: false } };

export default async function VerifyServerRender() {
  await connection();
  if (!sentryVerificationAllowed((await headers()).get("authorization")))
    notFound();
  throw new Error("Sentry verification: server render");
}
