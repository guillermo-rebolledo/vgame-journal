import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListReadUnavailable } from "@/components/list-read-unavailable";
import { ListSessionBoundary } from "@/components/list-session";
import { OwnerLists } from "@/components/owner-lists";
import { currentSession } from "@/lib/auth";
import { authPageHref } from "@/lib/auth-continuation";
import { lists, type OwnerList } from "@/lib/lists";

export const metadata: Metadata = {
  title: "Your lists",
  robots: { index: false, follow: false },
};

export default function ListsPage() {
  return (
    <section className="mx-auto grid w-full max-w-6xl flex-1 content-start grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance font-semibold text-3xl tracking-tight">
          Lists
        </h1>
        <p className="max-w-prose text-muted-foreground text-sm">
          Organize games into lists without adding them to your Journal.
        </p>
      </div>
      <Suspense
        fallback={
          <output className="col-span-full">Loading your lists…</output>
        }
      >
        <Content />
      </Suspense>
    </section>
  );
}

async function Content() {
  const session = await currentSession();
  if (!session) redirect(authPageHref("/sign-in", "/lists"));
  if (!session.user.username) redirect(authPageHref("/onboarding", "/lists"));
  let items: OwnerList[];
  try {
    items = await lists.ownerCollection(session.user.id);
  } catch {
    return <ListReadUnavailable />;
  }
  return (
    <ListSessionBoundary key={session.user.id} actor={session.user.id}>
      <OwnerLists actor={session.user.id} items={items} />
    </ListSessionBoundary>
  );
}
