import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicListDetail } from "@/components/public-list";
import { publicList } from "./list";

type Props = PageProps<"/u/[username]/lists/[listId]">;
const unavailableMetadata: Metadata = {
  title: "List unavailable",
  description: "This list is unavailable.",
  alternates: { canonical: null },
  robots: { index: false, follow: false },
  openGraph: {
    title: "List unavailable",
    description: "This list is unavailable.",
    url: null,
  },
  twitter: {
    card: "summary_large_image",
    title: "List unavailable",
    description: "This list is unavailable.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, listId } = await params;
  const list = await publicList(username, listId).catch(() => null);
  if (!list) return unavailableMetadata;
  const title = `${list.title} by ${list.creator.username}`;
  const description =
    list.description.slice(0, 200) ||
    `A public collection of ${list.gameCount} games by ${list.creator.username}.`;
  const url = `/u/${encodeURIComponent(list.creator.username ?? username)}/lists/${list.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function PublicListPage({ params }: Props) {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense
        fallback={
          <output className="text-muted-foreground">Loading list…</output>
        }
      >
        <List params={params} />
      </Suspense>
    </section>
  );
}

async function List({ params }: Pick<Props, "params">) {
  const { username, listId } = await params;
  let list: Awaited<ReturnType<typeof publicList>>;
  try {
    list = await publicList(username, listId);
  } catch {
    return (
      <div className="space-y-3">
        <p role="alert">Lists are unavailable. Please try again.</p>
        <a
          href={`/u/${encodeURIComponent(username)}/lists/${encodeURIComponent(listId)}`}
          className="inline-flex min-h-11 items-center rounded-md px-3 underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </a>
      </div>
    );
  }
  if (!list) notFound();
  return <PublicListDetail list={list} />;
}
