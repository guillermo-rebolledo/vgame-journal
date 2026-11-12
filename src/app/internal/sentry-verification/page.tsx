import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sentryVerificationAllowed } from "@/lib/sentry-verification";
import { VerificationControls } from "./verification-client";

export const metadata: Metadata = {
  title: "Monitoring verification",
  robots: { index: false, follow: false },
};

export default async function SentryVerificationPage() {
  await connection();
  if (!sentryVerificationAllowed((await headers()).get("authorization")))
    notFound();
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-8">
      <h1 className="font-semibold text-3xl">Monitoring verification</h1>
      <p>
        Owner-only synthetic errors. These controls do not write to your
        Journal.
      </p>
      <VerificationControls />
    </div>
  );
}
