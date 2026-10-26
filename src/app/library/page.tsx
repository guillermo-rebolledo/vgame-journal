import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CollectionLoading } from "@/components/collection-loading";
import { Library } from "@/components/library";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";
import { LIBRARY_VIEW_COOKIE } from "@/lib/library";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-3xl tracking-tight">Library</h1>
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
        <UserLibrary searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function UserLibrary({
  searchParams,
}: Pick<PageProps<"/library">, "searchParams">) {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  const [entries, cookieStore, params] = await Promise.all([
    journal.library(userId),
    cookies(),
    searchParams,
  ]);
  return (
    <Library
      // Library writes its own URL with replaceState, which doesn't reach the server; a real navigation (say, the nav's
      // bare /library) does, and the new key remounts it to read that URL.
      key={JSON.stringify(params)}
      entries={entries}
      initialView={
        cookieStore.get(LIBRARY_VIEW_COOKIE)?.value === "list" ? "list" : "grid"
      }
    />
  );
}
