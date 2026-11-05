import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListLoading } from "@/components/content-loading";
import { PublicListDetail } from "@/components/public-list";
import { ListsUnavailable } from "@/components/public-lists";
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
      <Suspense fallback={<ListLoading label="Loading list…" />}>
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
    return <ListsUnavailable />;
  }
  if (!list) notFound();
  return <PublicListDetail list={list} />;
}
