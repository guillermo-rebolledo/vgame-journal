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
import { capitalize, type LibraryEntry } from "@/lib/library";

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
  return (
    <HomeCoverTransitions>
      <div className="flex flex-col gap-3">
        <h1
          className={
            userId
              ? "font-semibold text-3xl tracking-tight"
              : "font-semibold text-4xl tracking-tight sm:text-5xl"
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
      {!userId && <JournalExample />}
      {!userId && <GuestActions />}
      <Suspense fallback={<output>Loading game search…</output>}>
        <GameSearch />
      </Suspense>
      {userId ? (
        <Suspense
          fallback={
            <output className="text-muted-foreground">
              Loading your shelves…
            </output>
          }
        >
          <YourJournal userId={userId} />
        </Suspense>
      ) : (
        <GettingStarted />
      )}
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
        <div className="flex items-center gap-4">
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
          Open it, then sign in to save a Status: Played, Playing, Backlog or
          Wishlist.
        </li>
        <li>
          Find your saved games in your Library. Follow releases in your
          Wishlist.
        </li>
      </ol>
    </div>
  );
}

async function YourJournal({ userId }: { userId: string }) {
  // The Library allowlist has no notes, so nothing private reaches Home.
  const entries = await journal.library(userId);
  const playing = entries.filter((e) => e.status === "playing").slice(0, 4);
  const recent = entries.filter((e) => e.status !== "playing").slice(0, 4);
  return (
    <div className="mt-2 flex flex-col gap-6 border-t pt-6">
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
              <span className="text-muted-foreground text-sm">
                {capitalize(e.status)}
              </span>
            </HomeCoverLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
