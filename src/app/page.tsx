import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DiscoveryBoundary } from "@/components/discovery-boundary";
import { GameCover } from "@/components/game-cover";
import { GameSearch } from "@/components/game-search";
import { HomeCoverTransitions } from "@/components/home-cover-link";
import {
  HomeCollections,
  HomeJournalProvider,
  HomePendingSave,
  HomeShelf,
} from "@/components/home-journal";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import { signedInUserId } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
import { homeEntries } from "@/lib/home-journal";
import { journal } from "@/lib/journal";

/**
 * The site itself, for search engines and AI crawlers.
 */
const siteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <JsonLd data={siteSchema} />
      <Suspense
        fallback={
          <output className="text-muted-foreground">
            Opening your Journal…
          </output>
        }
      >
        <HomeContent />
      </Suspense>
    </section>
  );
}

/** How to start, for visitors; what's going on in their Journal, for its owner. */
async function HomeContent() {
  const userId = await signedInUserId();
  const initial = userId
    ? journal
        .library(userId)
        .then((entries) => ({ owner: userId, entries: homeEntries(entries) }))
        .catch(() => ({ owner: userId, entries: null }))
    : Promise.resolve({ owner: null, entries: [] });
  return (
    <HomeCoverTransitions>
      <HomeJournalProvider
        key={userId ?? "guest"}
        owner={userId}
        initial={initial}
      >
        <div className="flex flex-col gap-3">
          <h1
            className={
              userId
                ? "font-semibold text-3xl tracking-tight [overflow-wrap:anywhere]"
                : "font-semibold text-4xl tracking-tight [overflow-wrap:anywhere] sm:text-5xl"
            }
          >
            {userId ? "Your Journal" : "Your games, remembered."}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {userId
              ? "Find a game to add, or pick up where you left off."
              : SITE_DESCRIPTION}
          </p>
        </div>
        <Suspense fallback={<output>Loading game search…</output>}>
          <GameSearch
            example={!userId && <JournalExample />}
            invitation={!userId && <GuestActions />}
          />
        </Suspense>
        <HomePendingSave />
        <HomeCollections />
        <DiscoveryBoundary>
          <Suspense fallback={null}>
            <Discovery />
          </Suspense>
        </DiscoveryBoundary>
        {!userId && <GettingStarted />}
      </HomeJournalProvider>
    </HomeCoverTransitions>
  );
}

function JournalExample() {
  return (
    <figure
      aria-label="Example Journal"
      className="flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-4">
          <GameCover imageId="co3byy" className="w-16 rounded-md" />
          <div>
            <p className="font-medium">Celeste</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Played · in your Library
            </p>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-1 border-t pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
          <p className="font-medium">Your next release</p>
          <p className="text-muted-foreground text-sm">
            Wishlist ·{" "}
            <span className="text-foreground tabular-nums">12 days to go</span>
          </p>
        </div>
      </div>
      <figcaption className="text-muted-foreground text-xs">
        Example Journal with an illustrative countdown.
      </figcaption>
    </figure>
  );
}

function GuestActions() {
  return (
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
  );
}

function GettingStarted() {
  return (
    <div className="mt-2 flex flex-col gap-4 border-t pt-6">
      <h2 className="font-semibold text-xl">How your Journal starts</h2>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
        <li>Search above for a game you’ve played or want to play.</li>
        <li>
          Add it to Backlog or Wishlist, or open its details to record a
          Playthrough.
        </li>
        <li>
          Find your saved games in your Library. Follow releases in your
          Wishlist.
        </li>
      </ol>
    </div>
  );
}

async function Discovery() {
  await connection();
  try {
    const shelves = await catalog.discovery();
    return shelves.map((shelf) => (
      <HomeShelf
        key={shelf.key}
        title={
          shelf.key === "recent" ? "Recently released" : "Popular right now"
        }
        games={shelf.games.map((g) => ({ ...g, gameId: g.id }))}
        refreshedAt={shelf.refreshedAt}
        event={[
          "home_shelf_opened",
          { shelf: shelf.key === "recent" ? "recent_releases" : "popular" },
        ]}
      />
    ));
  } catch {
    console.error("Home discovery unavailable");
    return null;
  }
}
