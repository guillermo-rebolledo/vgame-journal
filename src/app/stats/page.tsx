import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Stats } from "@/components/stats";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";

export const metadata: Metadata = { title: "Stats" };

export default function StatsPage() {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl tracking-tight">Stats</h1>
        <p className="text-muted-foreground">Your gaming journal, over time.</p>
      </div>
      <Suspense
        fallback={
          <output className="text-muted-foreground">Loading stats…</output>
        }
      >
        <UserStats />
      </Suspense>
    </section>
  );
}

async function UserStats() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  return <Stats stats={await journal.stats(userId)} />;
}
