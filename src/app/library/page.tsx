import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CollectionLoading } from "@/components/collection-loading";
import { Library } from "@/components/library";
import { buttonVariants } from "@/components/ui/button";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";
import { LIBRARY_VIEW_COOKIE } from "@/lib/library";
import { steamImportEnabled } from "@/lib/steam-server";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h1 className="font-semibold text-3xl tracking-tight">Library</h1>
          <Suspense fallback={null}>
            <SteamImportAction />
          </Suspense>
        </div>
        <details className="max-w-2xl text-muted-foreground text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:pointer-fine:min-h-8">
            About Status and Completion tags
          </summary>
          <p className="mt-1">
            Every game in your Journal has one Status: Played, Playing, Backlog
            or Wishlist. It changes only when you change it; a release never
            moves it for you. A Played game can also carry a Completion tag:
            Completed, Retired, Shelved or Abandoned. Wishlist games are part of
            your Library too; the{" "}
            <Link href="/wishlist" className="underline underline-offset-4">
              Wishlist
            </Link>{" "}
            shows them by release with a Countdown.
          </p>
        </details>
      </div>
      <Suspense fallback={<CollectionLoading collection="Library" />}>
        <UserLibrary />
      </Suspense>
    </section>
  );
}

async function SteamImportAction() {
  if (!(await signedInUserId()) || !(await steamImportEnabled())) return null;
  return (
    <Link
      href="/settings/steam"
      className={buttonVariants({ variant: "outline", className: "min-h-11" })}
    >
      Import from Steam
    </Link>
  );
}

async function UserLibrary() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  const [entries, cookieStore, enabled] = await Promise.all([
    journal.library(userId),
    cookies(),
    steamImportEnabled(),
  ]);
  return (
    <Library
      entries={entries}
      steamImportEnabled={enabled}
      initialView={
        cookieStore.get(LIBRARY_VIEW_COOKIE)?.value === "list" ? "list" : "grid"
      }
    />
  );
}
