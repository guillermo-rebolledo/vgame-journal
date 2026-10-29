import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { DiscoveryBoundary } from "@/components/discovery-boundary";
import { JsonLd } from "@/components/json-ld";
import { PlatformName, PlatformNames } from "@/components/platform";
import { Playthroughs } from "@/components/playthroughs";
import { Skeleton } from "@/components/ui/skeleton";
import { SITE_NAME, SITE_URL } from "@/config/site";
import { coverUrl } from "@/lib/game-source";
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
    <article className="relative isolate flex-1">
      <JsonLd data={videoGameSchema(game, cover)} />
      {cover && (
        <div
          aria-hidden
          className="-z-10 pointer-events-none absolute inset-0 overflow-hidden"
        >
          {/* biome-ignore lint/performance/noImgElement: IGDB CDN serves sized covers; no Next image optimization. */}
          <img
            src={cover}
            alt=""
            className="size-full scale-150 object-cover opacity-50 blur-3xl motion-safe:animate-drift dark:opacity-45"
          />
          <div className="absolute inset-0 bg-linear-to-b from-transparent to-background" />
        </div>
      )}

      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 sm:grid-cols-[minmax(0,15rem)_1fr] sm:py-12 md:grid-cols-[minmax(0,17rem)_1fr]">
        {cover ? (
          <ViewTransition
            name={`game-cover-${game.id}`}
            default="none"
            share="cover-morph"
          >
            {/* biome-ignore lint/performance/noImgElement: IGDB CDN serves sized covers; no Next image optimization. */}
            <img
              src={cover}
              alt={`${game.title} cover`}
              width={264}
              height={374}
              className="mx-auto aspect-[264/374] w-48 rounded-lg object-cover shadow-2xl sm:w-full"
            />
          </ViewTransition>
        ) : (
          <div className="mx-auto aspect-[264/374] w-48 rounded-lg bg-muted sm:w-full" />
        )}

        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-5xl">
              {game.title}
            </h1>
            {game.genres.length > 0 && (
              <p className="text-muted-foreground">{game.genres.join(", ")}</p>
            )}
          </header>

          <Suspense
            fallback={
              <output
                aria-label="Loading journal"
                className="flex min-h-24 flex-col gap-3"
              >
                <div className="flex gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <Skeleton className="size-11 rounded-full" />
                </div>
                <Skeleton className="h-5 w-48" />
              </output>
            }
          >
            <Playthroughs
              gameId={game.id}
              gameTitle={game.title}
              platforms={game.platforms}
            />
          </Suspense>

          <dl className="grid grid-cols-2 gap-4 sm:max-w-md">
            <Score
              label="Critic score"
              score={game.criticScore}
              count={game.criticScoreCount}
              noun="review"
            />
            <Score
              label="User score"
              score={game.userScore}
              count={game.userScoreCount}
              noun="rating"
            />
          </dl>

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

/** A VideoGame record, so a crawler reads the platforms, dates and scores without parsing the page. */
function videoGameSchema(
  game: Awaited<ReturnType<typeof findGame>> & object,
  cover: string | false | null,
) {
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

function Score({
  label,
  score,
  count,
  noun,
}: {
  label: string;
  score: number | null;
  count: number | null;
  noun: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-background/60 p-4 backdrop-blur">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-semibold text-3xl tabular-nums">
        {score === null ? "–" : Math.round(score)}
      </dd>
      <dd className="text-muted-foreground text-xs">
        {score === null
          ? "Not enough ratings yet"
          : count
            ? `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`
            : null}
      </dd>
    </div>
  );
}
