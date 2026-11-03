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
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl">Lists</h1>
      <p>Curate Catalog games independently of your Journal.</p>
      <Suspense fallback={<output>Loading your lists…</output>}>
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
