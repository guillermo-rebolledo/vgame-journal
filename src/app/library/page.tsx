import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TrackClicks } from "@/components/analytics";
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
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-6">
      <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
        <h1 className="font-semibold text-3xl tracking-tight [overflow-wrap:anywhere]">
          Library
        </h1>
        <div className="grid min-w-0 justify-self-end">
          <span
            aria-hidden="true"
            className={buttonVariants({
              variant: "outline",
              className: `${steamActionClass} invisible`,
            })}
          >
            Import from Steam
          </span>
          <Suspense fallback={null}>
            <SteamImportAction />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<CollectionLoading collection="Library" />}>
        <UserLibrary />
      </Suspense>
    </section>
  );
}

const steamActionClass =
  "col-start-1 row-start-1 h-auto min-h-11 min-w-0 whitespace-normal text-center [overflow-wrap:anywhere]";

async function SteamImportAction() {
  if (!(await signedInUserId()) || !(await steamImportEnabled())) return null;
  return (
    <TrackClicks event={["steam_import_opened", { surface: "library" }]}>
      <Link
        href="/settings/steam"
        className={buttonVariants({
          variant: "outline",
          className: steamActionClass,
        })}
      >
        Import from Steam
      </Link>
    </TrackClicks>
  );
}

async function UserLibrary() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  const [entries, cookieStore] = await Promise.all([
    journal.library(userId),
    cookies(),
  ]);
  return (
    <Library
      entries={entries}
      initialView={
        cookieStore.get(LIBRARY_VIEW_COOKIE)?.value === "list" ? "list" : "grid"
      }
    />
  );
}
