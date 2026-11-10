"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameCover } from "@/components/game-cover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { YearInReview } from "@/lib/journal";

async function prepareImage(includeUsername: boolean, asOf: string) {
  const response = await fetch(
    `/year-in-review/image?username=${includeUsername ? "1" : "0"}&asOf=${encodeURIComponent(asOf)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Image unavailable");
  return response.blob();
}
async function authorizeDownload() {
  const response = await fetch("/year-in-review/image", {
    method: "HEAD",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Review unavailable");
}

function Covers({
  section,
  label,
}: {
  section: YearInReview["logged"];
  label: string;
}) {
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {section.games.map((game) => (
          <li key={game.gameId} className="min-w-0">
            <Link
              href={`/games/${game.slug}`}
              className="journal-action block rounded-lg"
            >
              <GameCover
                imageId={game.coverImageId}
                className="w-full rounded-lg"
              />
              <span className="mt-2 block break-words text-sm">
                {game.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {section.count > section.games.length && (
        <p className="text-muted-foreground text-sm">
          {section.games.length} of {section.count.toLocaleString("en-US")}{" "}
          games {label}.
        </p>
      )}
    </div>
  );
}

/** Private seasonal recap. Export is prepared on demand and previewed as the actual PNG. */
export function YearInReviewPage({
  review,
  username,
  onPrepare = prepareImage,
  onAuthorizeDownload = authorizeDownload,
}: {
  review: YearInReview;
  username: string | null;
  onPrepare?: (includeUsername: boolean, asOf: string) => Promise<Blob>;
  onAuthorizeDownload?: () => Promise<void>;
}) {
  const [includeUsername, setIncludeUsername] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  const hasGames = review.logged.count + review.played.count > 0;

  async function prepare() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    setMessage("Preparing your image…");
    try {
      const blob = await onPrepare(includeUsername, review.asOf);
      setImage(URL.createObjectURL(blob));
      setMessage("Your image is ready. Check the preview before downloading.");
    } catch {
      setFailed(true);
      setMessage(
        "Your image could not be prepared. Retry, or reopen your review if it is no longer available.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function download() {
    if (!image || busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onAuthorizeDownload();
      const link = document.createElement("a");
      link.href = image;
      link.download = `shelve-games-your-year-in-the-journal-${review.year}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setMessage(
        "Your PNG is ready to save. If it opens in a new view, use your browser’s Save Image or Share action.",
      );
    } catch {
      setFailed(true);
      setMessage(
        "Download unavailable. Retry, or reopen your review if access has changed.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-3">
        <Link
          href="/stats"
          className="inline-flex min-h-11 items-center rounded-md underline underline-offset-4 focus-visible:outline-2"
        >
          Back to Stats
        </Link>
        <h1 className="font-semibold text-3xl tracking-tight">
          Your year in the Journal
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Games you logged, and the playing you recorded. Only you can open this
          review. Downloading an image leaves your Profile visibility unchanged.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <section
          className="review-tile space-y-4 rounded-xl bg-muted p-6 md:col-span-1"
          aria-labelledby="review-year"
        >
          <h2 id="review-year" className="font-medium text-xl">
            {review.year}
            {review.inProgress ? " so far" : ""}
          </h2>
          <p className="text-foreground text-sm">
            Through <time dateTime={review.through}>{review.through}</time>{" "}
            (UTC)
          </p>
          <p className="break-words font-semibold text-5xl tabular-nums tracking-tight">
            {review.logged.count.toLocaleString("en-US")}
          </p>
          <p className="text-lg">Games logged</p>
          <p className="text-foreground text-sm">
            Added to your Journal this year, in any Status. Edits do not count
            as new additions. Removing or re-adding a game changes this review.
          </p>
        </section>
        <section
          className="review-tile space-y-4 rounded-xl border border-border p-6 md:col-span-2"
          aria-labelledby="review-logged"
        >
          <h2 id="review-logged" className="font-medium text-xl">
            Latest games logged
          </h2>
          {review.logged.count ? (
            <Covers section={review.logged} label="logged" />
          ) : (
            <p className="text-muted-foreground">
              No games added in {review.year} yet.
            </p>
          )}
        </section>
        {review.played.count > 0 && (
          <section
            className="review-tile space-y-4 rounded-xl border border-border p-6 md:col-span-3"
            aria-labelledby="review-played"
          >
            <h2 id="review-played" className="font-medium text-xl">
              {review.played.count.toLocaleString("en-US")}{" "}
              {review.played.count === 1 ? "game" : "games"} played
            </h2>
            <p className="max-w-2xl text-muted-foreground text-sm">
              Based on recorded Playthrough date ranges overlapping this year
              through {review.through}, including open Playthroughs. Each game
              counts once. These games may also appear in Games logged; the
              totals are separate.
            </p>
            <Covers section={review.played} label="played" />
          </section>
        )}
      </div>
      {!hasGames ? (
        <section className="space-y-4">
          <h2 className="font-medium text-xl">
            A year still waiting to be recorded
          </h2>
          <p className="text-muted-foreground">
            Add a game, or open a game in your Library to record a dated
            Playthrough.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Find a game
            </Link>
            <Link
              href="/library"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Open Library
            </Link>
          </div>
        </section>
      ) : (
        <section
          className="space-y-4 border-border border-t pt-8"
          aria-labelledby="review-keepsake"
        >
          <h2 id="review-keepsake" className="font-medium text-xl">
            Keep a little of your year
          </h2>
          <p className="max-w-2xl text-muted-foreground text-sm">
            A portrait PNG with your counts and selected covers. No private
            notes or account details. You choose where to share it.
          </p>
          {username && (
            <div className="flex min-h-11 items-center gap-3">
              <Checkbox
                id="review-username"
                checked={includeUsername}
                disabled={pending}
                onCheckedChange={(checked) => {
                  setIncludeUsername(checked);
                  setImage(null);
                  setMessage("");
                  setFailed(false);
                }}
              />
              <Label
                htmlFor="review-username"
                className="min-h-11 break-all leading-normal"
              >
                Include username (@{username})
              </Label>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={prepare}
              loading={pending}
              className="min-h-11"
              variant={image ? "outline" : "default"}
            >
              {failed && !image
                ? "Retry image"
                : image
                  ? "Refresh preview"
                  : "Preview PNG"}
            </Button>
            {image && (
              <Button
                onClick={download}
                disabled={pending}
                className="min-h-11"
              >
                {failed ? "Retry download" : "Download PNG"}
              </Button>
            )}
          </div>
          <output aria-live="polite" className="text-muted-foreground text-sm">
            {message}
          </output>
          {image && (
            <figure className="max-w-md space-y-2">
              {/* biome-ignore lint/performance/noImgElement: the preview is the exact on-demand PNG blob, not a Next image asset. */}
              <img
                src={image}
                alt={`PNG preview of your ${review.year} Journal review${includeUsername && username ? ` for @${username}` : ", without your username"}`}
                width={1080}
                height={1350}
                className="h-auto w-full rounded-xl"
              />
              <figcaption className="text-muted-foreground text-sm">
                This is the image you will download. 1080 × 1350 pixels.
              </figcaption>
            </figure>
          )}
        </section>
      )}
    </div>
  );
}
