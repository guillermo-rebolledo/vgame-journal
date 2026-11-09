import type { Metadata } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CollectionLoading } from "@/components/collection-loading";
import { Wishlist } from "@/components/wishlist";
import { ownerId, signedInUserId } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
import { journal, type Status } from "@/lib/journal";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl tracking-tight">Wishlist</h1>
      <Suspense fallback={<CollectionLoading collection="Wishlist" />}>
        <UserWishlist />
      </Suspense>
    </section>
  );
}

async function UserWishlist() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");

  /** Moves a released game off the wishlist, or undoes that move if the entry is untouched since. */
  async function move(
    gameId: number,
    from: { status: Status; updatedAt?: Date },
    to: Status,
  ) {
    "use server";
    const owner = await ownerId();
    const offWishlist =
      from.status === "wishlist" && (to === "backlog" || to === "playing");
    // Undo must name the move it reverses, so it can't overwrite a later change.
    const undo =
      (from.status === "backlog" || from.status === "playing") &&
      to === "wishlist" &&
      from.updatedAt instanceof Date;
    if (!offWishlist && !undo) throw new Error("Not a Wishlist move.");
    const at = await journal.move(
      owner,
      gameId,
      { status: from.status, updatedAt: undo ? from.updatedAt : undefined },
      to,
    );
    refresh();
    return at;
  }

  const [entries, releaseDatesUnavailable] = await Promise.all([
    journal.wishlist(userId),
    catalog
      .refreshHealth()
      .then((health) => {
        const task = health.tasks.find((task) => task.key === "wishlist");
        return (
          !task?.lastSuccessAt ||
          task.freshness === "stale" ||
          task.outcome === "failure"
        );
      })
      .catch(() => true),
  ]);
  return (
    <Wishlist
      entries={entries}
      onMove={move}
      releaseDatesUnavailable={releaseDatesUnavailable}
    />
  );
}
