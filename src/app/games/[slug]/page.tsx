import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { DiscoveryBoundary } from "@/components/discovery-boundary";
import { GameCover } from "@/components/game-cover";
import { AgeRatingFact, AgeRatingFactSkeleton } from "@/components/game-facts";
import { GameFactsGrid } from "@/components/game-facts-grid";
import { GameLists } from "@/components/game-lists";
import { JsonLd } from "@/components/json-ld";
import { PlatformName, PlatformNames } from "@/components/platform";
import { Playthroughs } from "@/components/playthroughs";
import { Skeleton } from "@/components/ui/skeleton";
import { SITE_NAME, SITE_URL } from "@/config/site";
import { boardName, pickRatings } from "@/lib/age-ratings";
import { signedInUserId } from "@/lib/auth";
import { coverUrl, type SourceAgeRating } from "@/lib/game-source";
import { journal } from "@/lib/journal";
import { regionName, releaseLabel } from "@/lib/release-dates";
import { findGame } from "./game";
import { GameTagShelves } from "./tag-shelves";

/** Search engines show about 160 characters; a summary cut mid-word reads worse than one cut at a space. */
function clamp(text: string, max = 160) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")) || cut}…`;
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">): Promise<Metadata> {
  const game = await findGame((await params).slug);
  if (!game) return {};
  const description = clamp(
    game.summary ??
      `${game.title}: platforms, release dates and scores, plus your own playthroughs, on ${SITE_NAME}.`,
  );
  const url = `/games/${game.slug}`;
  return {
    title: game.title,
    description,
    alternates: { canonical: url },
    // og:image comes from opengraph-image.tsx; file-based metadata wins over anything set here.
    openGraph: { title: game.title, description, url },
  };
}

export default function GamePage({ params }: PageProps<"/games/[slug]">) {
  return <Game params={params} />;
}

async function Game({ params }: Pick<PageProps<"/games/[slug]">, "params">) {
  // ponytail: an unknown slug streams the not-found page (noindex) with a 200, since the App Shell has already gone out.
  // A real 404 needs a slug check in Proxy (docs: loading.md#status-codes); add it if analytics or crawlers need the status.
  const game = await findGame((await params).slug);
  if (!game) notFound();
  const cover = game.coverImageId && coverUrl(game.coverImageId);

  return (
    <article className="@container relative isolate flex-1">
      <JsonLd data={videoGameSchema(game, cover)} />
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 @min-[40em]:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @min-[40em]:gap-x-8 @min-[40em]:py-12 @min-[48em]:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <header className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-4 @min-[40em]:contents">
          <ViewTransition
            name={`game-cover-${game.id}`}
            default="none"
            share="cover-morph"
          >
            <GameCover
              imageId={game.coverImageId}
              className="w-20 self-start rounded-lg shadow-2xl @min-[40em]:row-span-2 @min-[40em]:w-full"
            />
          </ViewTransition>

          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-balance font-semibold text-3xl tracking-tight [overflow-wrap:anywhere] @min-[40em]:text-5xl">
              {game.title}
            </h1>
            {game.genres.length > 0 && (
              <p className="wrap-anywhere text-muted-foreground">
                {game.genres.join(", ")}
              </p>
            )}
          </div>
        </header>

        <div className="flex min-w-0 flex-col gap-6 @min-[40em]:col-start-2">
          <Suspense
            fallback={
              <output
                aria-label="Loading journal"
                className="flex flex-col gap-2"
              >
                <div className="flex flex-wrap gap-3">
                  <Skeleton className="h-11 w-40" />
                  <Skeleton className="h-11 w-36" />
                  <Skeleton className="h-11 w-28" />
                </div>
                <Skeleton className="h-5 w-32" />
              </output>
            }
          >
            <Playthroughs
              gameId={game.id}
              gameTitle={game.title}
              platforms={game.platforms}
              listPicker={
                <Suspense fallback={<output>Loading list controls…</output>}>
                  <GameLists
                    game={{ id: game.id, slug: game.slug, title: game.title }}
                  />
                </Suspense>
              }
            />
          </Suspense>

          <GameFactsGrid
            game={game}
            ageRating={
              game.ageRatings?.length ? (
                <Suspense fallback={<AgeRatingFactSkeleton />}>
                  <AgeRating ratings={game.ageRatings} />
                </Suspense>
              ) : undefined
            }
          />

          {game.summary && (
            <p className="max-w-prose text-pretty leading-relaxed">
              {game.summary}
            </p>
          )}

          {game.platforms.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-medium">Platforms</h2>
              <p className="text-muted-foreground">
                <PlatformNames platforms={game.platforms} />
              </p>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-medium">Release dates</h2>
            {game.releaseDates.length === 0 ? (
              <p className="text-muted-foreground">TBA</p>
            ) : (
              <ul className="divide-y divide-border/60 text-sm">
                {game.releaseDates.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                  >
                    <span>
                      {d.platform ? (
                        <PlatformName platform={d.platform} />
                      ) : (
                        "All platforms"
                      )}
                      <span className="text-muted-foreground">
                        {" "}
                        · {regionName(d.region)}
                        {d.status && ` · ${d.status}`}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {releaseLabel(d.date, d.precision)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <DiscoveryBoundary>
        <Suspense fallback={null}>
          <GameTagShelves game={game} />
        </Suspense>
      </DiscoveryBoundary>
    </article>
  );
}

/** The board follows the signed-in user's Region, so this streams at request time; the cached game stays user-independent. */
async function AgeRating({ ratings }: { ratings: SourceAgeRating[] }) {
  const userId = await signedInUserId();
  const region = userId ? await journal.region(userId) : null;
  return <AgeRatingFact {...pickRatings(ratings, region)} />;
}

/** A VideoGame record, so a crawler reads the platforms, dates and scores without parsing the page. */
function videoGameSchema(
  game: Awaited<ReturnType<typeof findGame>> & object,
  cover: string | false | null,
) {
  // The guest board, so the cached markup stays user-independent.
  const rating = pickRatings(game.ageRatings ?? [], null).headline;
  const released = game.releaseDates
    .filter((d) => d.date && d.precision === "day")
    .map((d) => d.date as Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    url: `${SITE_URL}/games/${game.slug}`,
    ...(game.summary && { description: game.summary }),
    ...(cover && { image: cover }),
    ...(game.genres.length > 0 && { genre: game.genres }),
    ...(game.platforms.length > 0 && { gamePlatform: game.platforms }),
    ...(rating && {
      contentRating: `${boardName(rating.board)} ${rating.rating}`,
    }),
    ...(game.languages?.length && {
      inLanguage: game.languages.map((l) => l.name),
    }),
    ...(released && { datePublished: released.toISOString().slice(0, 10) }),
    ...(game.userScore !== null &&
      game.userScoreCount && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Math.round(game.userScore),
          ratingCount: game.userScoreCount,
          bestRating: 100,
          worstRating: 0,
        },
      }),
  };
}
