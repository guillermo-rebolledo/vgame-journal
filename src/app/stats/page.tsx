import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StatsLoading } from "@/components/content-loading";
import { Stats } from "@/components/stats";
import { signedInUserId } from "@/lib/auth";
import { yearInReviewFlag } from "@/lib/flags";
import { journal } from "@/lib/journal";

export const metadata: Metadata = { title: "Stats" };

export default function StatsPage() {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl tracking-tight">Stats</h1>
        <p className="text-muted-foreground">Your gaming journal, over time.</p>
      </div>
      <Suspense fallback={<StatsLoading />}>
        <UserStats />
      </Suspense>
    </section>
  );
}

async function UserStats() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  return (
    <>
      {(await yearInReviewFlag()) && (
        <Link
          href="/year-in-review"
          prefetch={false}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 underline underline-offset-4 focus-visible:outline-2"
        >
          Your year in the Journal · 2026
        </Link>
      )}
      <Stats stats={await journal.stats(userId)} />
    </>
  );
}
