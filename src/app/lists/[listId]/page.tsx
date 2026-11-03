import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ListReadUnavailable } from "@/components/list-read-unavailable";
import { ListSessionBoundary } from "@/components/list-session";
import { OwnerListEditor } from "@/components/owner-lists";
import { currentSession } from "@/lib/auth";
import { authPageHref } from "@/lib/auth-continuation";
import { lists, type OwnerList } from "@/lib/lists";

export const metadata: Metadata = {
  title: "Manage list",
  robots: { index: false, follow: false },
};

export default function ListPage({ params }: PageProps<"/lists/[listId]">) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/lists" prefetch={false} className="underline">
        All lists
      </Link>
      <Suspense fallback={<output>Loading your list…</output>}>
        <Content params={params} />
      </Suspense>
    </section>
  );
}

async function Content({
  params,
}: Pick<PageProps<"/lists/[listId]">, "params">) {
  const { listId } = await params;
  const session = await currentSession();
  const path = `/lists/${encodeURIComponent(listId)}`;
  if (!session) redirect(authPageHref("/sign-in", path));
  if (!session.user.username) redirect(authPageHref("/onboarding", path));
  let list: OwnerList | null;
  try {
    list = await lists.ownerDetail(session.user.id, listId);
  } catch {
    return <ListReadUnavailable />;
  }
  if (!list) notFound();
  return (
    <ListSessionBoundary
      key={`${session.user.id}:${list.id}`}
      actor={session.user.id}
    >
      <OwnerListEditor actor={session.user.id} initial={list} />
    </ListSessionBoundary>
  );
}
