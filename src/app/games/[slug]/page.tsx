import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JournalStatus } from "@/components/journal-status";
import { Playthroughs } from "@/components/playthroughs";
import { catalog } from "@/lib/catalog";
import { coverUrl } from "@/lib/game-source";
import { regionName, releaseLabel } from "@/lib/release-dates";

async function findGame(slug: string) {
  "use cache";
  cacheLife("hours");
  return catalog.findBySlug(slug);
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">): Promise<Metadata> {
  const game = await findGame((await params).slug);
  return game ? { title: game.title, description: game.summary } : {};
}

export default function GamePage({ params }: PageProps<"/games/[slug]">) {
  return (
    <Suspense
      fallback={<div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8" />}
    >
      <Game params={params} />
    </Suspense>
  );
}

async function Game({ params }: Pick<PageProps<"/games/[slug]">, "params">) {
  // ponytail: an unknown slug streams the not-found page (noindex) with a 200, since the App Shell has already gone out.
  // A real 404 needs a slug check in Proxy (docs: loading.md#status-codes); add it if analytics or crawlers need the status.
  const game = await findGame((await params).slug);
  if (!game) notFound();
  const cover = game.coverImageId && coverUrl(game.coverImageId);

  return (
    <article className="relative isolate flex-1">
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
          // biome-ignore lint/performance/noImgElement: IGDB CDN serves sized covers; no Next image optimization.
          <img
            src={cover}
            alt={`${game.title} cover`}
            width={264}
            height={374}
            className="mx-auto aspect-[264/374] w-48 rounded-lg object-cover shadow-2xl sm:w-full"
          />
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

          <Suspense fallback={<div className="h-28 sm:max-w-md" />}>
            <JournalStatus gameId={game.id} />
          </Suspense>
          <Suspense fallback={<div className="h-28 sm:max-w-md" />}>
            <Playthroughs gameId={game.id} platforms={game.platforms} />
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
                {game.platforms.join(", ")}
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
                      {d.platform ?? "All platforms"}
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
    </article>
  );
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
