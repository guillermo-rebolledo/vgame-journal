"use server";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { sentryVerificationAllowed } from "@/lib/sentry-verification";

export async function verifySentryAction() {
  if (!sentryVerificationAllowed((await headers()).get("authorization")))
    notFound();
  throw new Error("Sentry verification: server action");
}
