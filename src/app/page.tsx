import { connection } from "next/server";
import { Suspense } from "react";
import type { ProductEvent } from "@/components/analytics";
import { DiscoveryBoundary } from "@/components/discovery-boundary";
import { GameCover } from "@/components/game-cover";
import { GameSearch } from "@/components/game-search";
import { HomeAuthActions } from "@/components/home-auth-actions";
import {
  HomeCoverLink,
  HomeCoverTransitions,
} from "@/components/home-cover-link";
import { HomeIntroduction, JournalExample } from "@/components/home-guest";
import { HomeJournal } from "@/components/home-journal";
import { HomeWishlistPreview } from "@/components/home-wishlist-preview";
import { JsonLd } from "@/components/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import { signedInUserId } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
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
      {userId ? (
        <div className="flex flex-col gap-3">
          <h1 className="font-semibold text-3xl tracking-tight [overflow-wrap:anywhere]">
            Your Journal
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Find a game to add, or pick up where you left off.
          </p>
        </div>
      ) : (
        <HomeIntroduction />
      )}
      <div className="flex flex-col gap-3">
        <p id="home-search-guidance" className="text-muted-foreground text-sm">
          Find a game, then save it to Backlog or Wishlist.
          {!userId && " Sign in to save its Status in your Journal."}
        </p>
        <Suspense fallback={<output>Loading game search…</output>}>
          <GameSearch />
        </Suspense>
      </div>
      {!userId && (
        <div className="flex flex-col gap-4">
          <Suspense fallback={null}>
            <HomeAuthActions />
          </Suspense>
          <JournalExample />
        </div>
      )}
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
      ) : null}
      <DiscoveryBoundary>
        <Suspense fallback={null}>
          <Discovery />
        </Suspense>
      </DiscoveryBoundary>
    </HomeCoverTransitions>
  );
}

async function YourJournal({ userId }: { userId: string }) {
  // Both reads are owner-scoped allowlists with no private notes.
  const [entries, wishlist] = await Promise.all([
    journal.library(userId),
    journal.wishlist(userId),
  ]);
  return (
    <HomeJournal
      entries={entries}
      wishlistPreview={<HomeWishlistPreview entries={wishlist} />}
    />
  );
}

async function Discovery() {
  await connection();
  try {
    const shelves = await catalog.discovery();
    return shelves.map((shelf) => (
      <Shelf
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

function Shelf({
  title,
  games,
  refreshedAt,
  event,
}: {
  title: string;
  games: (Pick<LibraryEntry, "gameId" | "title" | "slug" | "coverImageId"> &
    Partial<Pick<LibraryEntry, "status">>)[];
  refreshedAt?: Date;
  event?: ProductEvent;
}) {
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
              event={event}
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
              {e.status && (
                <span className="text-muted-foreground text-sm">
                  {capitalize(e.status)}
                </span>
              )}
            </HomeCoverLink>
          </li>
        ))}
      </ul>
      {refreshedAt && (
        <p className="text-muted-foreground text-xs">
          Updated{" "}
          <time dateTime={refreshedAt.toISOString()}>
            {refreshedAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </p>
      )}
    </section>
  );
}
