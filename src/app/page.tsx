import Link from "next/link";
import { Suspense } from "react";
import { GameCover } from "@/components/game-cover";
import { GameSearch } from "@/components/game-search";
import {
  HomeCoverLink,
  HomeCoverTransitions,
} from "@/components/home-cover-link";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";
import type { LibraryEntry } from "@/lib/library";

/**
 * The site itself, for search engines and AI crawlers.
 * ponytail: no SearchAction — the search box is client-side, so there is no `?q=` URL to point one at.
 * Add one once a query lives in the URL.
 */
const siteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
};

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-24">
      <JsonLd data={siteSchema} />
      <h1 className="font-semibold text-4xl tracking-tight sm:text-6xl">
        {SITE_NAME}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        {SITE_DESCRIPTION}
      </p>
      <HomeCoverTransitions>
        <GameSearch />
        <Suspense>
          <YourJournal />
        </Suspense>
      </HomeCoverTransitions>
    </section>
  );
}

/** How to start, for visitors; what's going on in their Journal, for its owner. */
async function YourJournal() {
  const userId = await signedInUserId();
  if (!userId)
    return (
      <div className="mt-8 flex flex-col gap-4 border-t pt-8">
        <h2 className="font-semibold text-xl">How your Journal starts</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
          <li>Search above for a game you’ve played or want to play.</li>
          <li>
            Open it and set a Status: Played, Playing, Backlog or Wishlist.
          </li>
          <li>
            That game is now in your Journal. Your Library collects them, and
            your Wishlist counts down to releases.
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sign-up"
            className={buttonVariants({
              variant: "default",
              className: "h-11 px-4",
            })}
          >
            Sign up to start a Journal
          </Link>
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: "ghost", className: "h-11" })}
          >
            Sign in to your Journal
          </Link>
        </div>
      </div>
    );

  // The Library allowlist has no notes, so nothing private reaches Home.
  const entries = await journal.library(userId);
  const playing = entries.filter((e) => e.status === "playing").slice(0, 4);
  const recent = entries.filter((e) => e.status !== "playing").slice(0, 4);
  return (
    <div className="mt-8 flex flex-col gap-6 border-t pt-8">
      {entries.length === 0 ? (
        <p className="text-muted-foreground">
          Your Journal is empty. Search above, open a game, and set its Status
          to add it.
        </p>
      ) : (
        <>
          {playing.length > 0 && <Shelf title="Playing" games={playing} />}
          {recent.length > 0 && <Shelf title="Recently added" games={recent} />}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/library"
          className={buttonVariants({ variant: "outline", className: "h-11" })}
        >
          Library ({entries.length})
        </Link>
        <Link
          href="/wishlist"
          className={buttonVariants({ variant: "outline", className: "h-11" })}
        >
          Wishlist ({entries.filter((e) => e.status === "wishlist").length})
        </Link>
      </div>
    </div>
  );
}

function Shelf({ title, games }: { title: string; games: LibraryEntry[] }) {
  const id = `home-${title.toLowerCase().replace(/ /g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-semibold text-xl">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {games.map((e) => (
          <li key={e.gameId}>
            <HomeCoverLink
              gameId={e.gameId}
              source="shelf"
              href={`/games/${e.slug}`}
              className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              cover={
                <GameCover
                  imageId={e.coverImageId}
                  className="w-full rounded-lg shadow-lg"
                />
              }
            >
              <span className="line-clamp-2 font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
                {e.title}
              </span>
            </HomeCoverLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
