import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Library } from "@/components/library";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";
import { LIBRARY_VIEW_COOKIE } from "@/lib/library";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl tracking-tight">Library</h1>
      <Suspense>
        <UserLibrary />
      </Suspense>
    </section>
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
