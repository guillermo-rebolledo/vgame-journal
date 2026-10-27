"use client";

import Link from "next/link";
import { useState } from "react";
import { Library } from "@/components/library";
import { PagedList } from "@/components/paged-list";
import { Stats } from "@/components/stats";
import { Wishlist } from "@/components/wishlist";
import type { journal } from "@/lib/journal";

type Profile = NonNullable<Awaited<ReturnType<typeof journal.publicProfile>>>;
const tabs = ["Library", "Wishlist", "Stats"] as const;

export function PublicProfile({ profile }: { profile: Profile }) {
  const games = new Map(profile.library.map((game) => [game.gameId, game]));
  const [tab, setTab] = useState<(typeof tabs)[number]>("Library");
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {profile.image ? (
          // biome-ignore lint/performance/noImgElement: Google avatar is served directly, without Next image optimization.
          <img
            src={profile.image}
            alt=""
            referrerPolicy="no-referrer"
            className="size-16 rounded-full object-cover"
            width={64}
            height={64}
          />
        ) : (
          <div
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-2xl uppercase"
          >
            {profile.username?.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="break-words font-semibold text-3xl tracking-tight">
            {profile.username}
          </h1>
          <p className="text-muted-foreground text-sm">Public gaming journal</p>
        </div>
      </div>
      <fieldset className="flex gap-1 border-b">
        <legend className="sr-only">Profile views</legend>
        {tabs.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={tab === label}
            onClick={() => setTab(label)}
            className={`border-b-2 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === label ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </fieldset>
      {tab === "Library" && (
        <div className="space-y-10">
          <Library entries={profile.library} initialView="grid" readOnly />
          {profile.playthroughs.length > 0 && (
            <section className="space-y-4 border-t pt-6">
              <h2 className="font-semibold text-xl">Playthroughs</h2>
              <PagedList
                items={profile.playthroughs}
                label="Public playthroughs"
              >
                {(visible, offset) => (
                  <ul className="divide-y divide-border/60">
                    {visible.map((playthrough, index) => {
                      const game = games.get(playthrough.gameId);
                      return (
                        <li
                          key={`${playthrough.gameId}-${offset + index}`}
                          className="flex flex-col justify-between gap-2 py-4 sm:flex-row"
                        >
                          <div>
                            <Link
                              href={`/games/${game?.slug}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {game?.title}
                            </Link>
                            <p className="text-muted-foreground text-sm">
                              {playthrough.platform}
                            </p>
                          </div>
                          <p className="text-muted-foreground text-sm tabular-nums">
                            <time dateTime={playthrough.startedOn}>
                              {playthrough.startedOn}
                            </time>{" "}
                            –{" "}
                            {playthrough.endedOn ? (
                              <time dateTime={playthrough.endedOn}>
                                {playthrough.endedOn}
                              </time>
                            ) : (
                              "ongoing"
                            )}
                            {playthrough.hours !== null &&
                              ` · ${playthrough.hours} h`}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PagedList>
            </section>
          )}
        </div>
      )}
      {tab === "Wishlist" && <Wishlist entries={profile.wishlist} />}
      {tab === "Stats" && (
        <Stats
          stats={profile.stats}
          libraryHref={`/u/${profile.username}`}
          readOnly
        />
      )}
    </div>
  );
}
