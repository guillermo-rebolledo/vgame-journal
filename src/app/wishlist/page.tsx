import type { Metadata } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Wishlist } from "@/components/wishlist";
import { ownerId, signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl tracking-tight">Wishlist</h1>
      <Suspense>
        <UserWishlist />
      </Suspense>
    </section>
  );
}

async function UserWishlist() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");

  /** Moves a released game off the wishlist. */
  async function move(gameId: number, status: "backlog" | "playing") {
    "use server";
    const owner = await ownerId();
    if (status !== "backlog" && status !== "playing") return;
    if ((await journal.entry(owner, gameId))?.status !== "wishlist") return;
    await journal.set(owner, gameId, { status });
    refresh();
  }

  return <Wishlist entries={await journal.wishlist(userId)} onMove={move} />;
}
