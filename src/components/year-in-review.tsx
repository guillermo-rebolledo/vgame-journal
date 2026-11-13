"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { trackEvent } from "@/components/analytics";
import { GameCover } from "@/components/game-cover";
import { ActionFeedback } from "@/components/ui/action-feedback";
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

type Game = YearInReview["logged"]["games"][number];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Sheet type is sized in cqw so the sheet scales as one object, like the print it imitates.
// One class per property in these strings: a later utility does not reliably win over an earlier one.
const box = "min-h-0 min-w-0 overflow-hidden p-[3cqw]";
const cell = `${box} flex flex-col`;
const paper = `${cell} bg-keepsake-paper`;
const label =
  "font-medium text-[clamp(0.625rem,2.1cqw,0.8125rem)] uppercase leading-tight tracking-wide";
const figure = "font-medium tabular-nums tracking-tighter";
const title = "font-medium text-lg tracking-tight";
const railLink =
  "inline-flex min-h-11 items-center rounded-md underline underline-offset-4 focus-visible:outline-2";
// Ink, not the theme foreground: Chalk disappears against the paper in the Dark theme.
const sheetLink =
  "block rounded-sm outline-keepsake-ink focus-visible:outline-3 focus-visible:outline-offset-2";

/** Largest size, in cqw, at which a number still fits its cell. Geist Mono digits are 0.6em wide. */
const fit = (text: string, largest: number, room: number) =>
  `${Math.min(largest, room / (text.length * 0.62)).toFixed(2)}cqw`;

/** Up to three overlapping covers; each is its own link, named by its hidden title. */
function CoverFan({ games }: { games: Game[] }) {
  const shown = games.slice(0, 3);
  const left = "-mr-[10%] w-[36%] translate-y-[4%] -rotate-6";
  const right = "-ml-[10%] w-[36%] translate-y-[4%] rotate-6";
  const tilt = [
    [],
    ["z-10 w-[42%]"],
    [left, right],
    [left, "z-10 w-[42%]", right],
  ];
  return (
    <ul className="flex min-h-0 flex-1 items-center justify-center">
      {shown.map((game, i) => (
        <li key={game.gameId} className={tilt[shown.length][i]}>
          <Link
            href={`/games/${game.slug}`}
            className={`${sheetLink} rounded-lg transition-[translate] duration-150 ease-out motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1.5`}
          >
            <GameCover
              imageId={game.coverImageId}
              className="w-full overflow-hidden rounded-lg shadow-lg"
            />
            <span className="sr-only">{game.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Private seasonal recap: a ruled 4:5 sheet beside the keepsake controls.
 * Export is prepared on demand and previewed as the actual PNG, matching the sheet.
 */
export function YearInReviewPage({
  review,
  username,
  onOpened,
  onPrepare = prepareImage,
  onAuthorizeDownload = authorizeDownload,
}: {
  onOpened?: () => Promise<void>;
  review: YearInReview;
  username: string | null;
  onPrepare?: (includeUsername: boolean, asOf: string) => Promise<Blob>;
  onAuthorizeDownload?: () => Promise<void>;
}) {
  const [, startVisit] = useTransition();
  useEffect(() => {
    if (onOpened)
      startVisit(async () => {
        // A failed visit marker must not prevent viewing or exporting; retry on the next visit.
        try {
          await onOpened();
        } catch {}
      });
  }, [onOpened]);
  const [includeUsername, setIncludeUsername] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [pointerPreview, setPointerPreview] = useState(false);
  const [operation, setOperation] = useState<"prepare" | "download" | null>(
    null,
  );
  const pending = operation !== null;
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
  useEffect(() => {
    trackEvent("year_in_review_viewed", { has_games: hasGames });
  }, [hasGames]);

  async function prepare() {
    if (busy.current) return;
    busy.current = true;
    setOperation("prepare");
    setFailed(false);
    setMessage("Preparing your image…");
    try {
      const blob = await onPrepare(includeUsername, review.asOf);
      setImage(URL.createObjectURL(blob));
      trackEvent("year_in_review_image", {
        step: "preview",
        username: includeUsername,
      });
      setMessage("Your image is ready. Check the preview before downloading.");
    } catch {
      setFailed(true);
      setMessage(
        "Your image could not be prepared. Retry, or reopen your review if it is no longer available.",
      );
    } finally {
      busy.current = false;
      setOperation(null);
    }
  }
  async function download() {
    if (!image || busy.current) return;
    busy.current = true;
    setOperation("download");
    setMessage("Preparing your download…");
    setFailed(false);
    try {
      await onAuthorizeDownload();
      const link = document.createElement("a");
      link.href = image;
      link.download = `shelve-games-your-year-in-the-journal-${review.year}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      trackEvent("year_in_review_image", {
        step: "download",
        username: includeUsername,
      });
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
      setOperation(null);
    }
  }

  const { logged, played } = review;
  const loggedCount = logged.count.toLocaleString("en-US");
  const playedCount = played.count.toLocaleString("en-US");
  const hours = Math.round(review.hours).toLocaleString("en-US");
  const busiest = Math.max(...review.loggedByMonth, 1);
  // The year is the largest thing on the sheet, so the date beside it drops it.
  const through = new Date(`${review.through}T00:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
  const platformWord = Math.max(
    ...(review.topPlatform?.name ?? "").split(/\s+/).map((word) => word.length),
    1,
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-6 px-4 py-8 font-mono lg:grid-cols-[minmax(0,35rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <header className="space-y-3 lg:col-start-2">
        <Link href="/stats" className={railLink}>
          Back to Stats
        </Link>
        <h1 className="text-balance font-medium text-2xl tracking-tighter sm:text-3xl">
          Your year in the Journal
        </h1>
        <p className="max-w-prose text-muted-foreground text-sm">
          Games you logged, and the playing you recorded, through{" "}
          <time dateTime={review.through} className="whitespace-nowrap">
            {review.through}
          </time>{" "}
          (UTC). Only you can open this review. Downloading an image leaves your
          Profile visibility unchanged.
        </p>
      </header>

      <div className="@container mx-auto w-full max-w-[35rem] lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="review-tile grid aspect-[4/5] grid-cols-4 grid-rows-5 gap-px overflow-hidden rounded-lg border border-keepsake-ink bg-keepsake-ink text-keepsake-ink">
          <div className={`${paper} col-span-3 justify-between`}>
            <p className={label}>Your year in the Journal</p>
            <div className="flex items-end gap-[2cqw]">
              <h2 className={`${figure} text-[14cqw] leading-[0.8]`}>
                {review.year}
              </h2>
              <p className={label}>
                {review.inProgress ? "so far, " : ""}through{" "}
                <time dateTime={review.through}>{through}</time>
              </p>
            </div>
          </div>
          <div
            className={`${cell} items-center justify-center gap-[1cqw] bg-keepsake-marker`}
          >
            <Image
              src="/logo-light.png"
              alt=""
              width={192}
              height={132}
              className="h-[8cqw] w-auto"
            />
            <span className="font-medium text-[clamp(0.625rem,2.1cqw,0.8125rem)] @max-md:hidden">
              shelve.games
            </span>
          </div>

          <section
            className={`${cell} col-span-2 row-span-2 justify-between bg-keepsake-ink text-keepsake-marker`}
          >
            <h2 className={label}>Games logged</h2>
            <p
              className={`${figure} leading-[0.8]`}
              style={{ fontSize: fit(loggedCount, 32, 43) }}
            >
              {loggedCount}
            </p>
            <p className={label}>Added to your Journal, in any Status</p>
          </section>
          <section className={`${paper} col-span-2 row-span-2 gap-[2cqw]`}>
            <h2 className={label}>Latest logged</h2>
            {logged.count ? (
              <CoverFan games={logged.games} />
            ) : (
              <p className={`${label} my-auto`}>
                No games added in {review.year} yet.
              </p>
            )}
          </section>

          <section className={`${paper} col-span-2 gap-[1.5cqw]`}>
            <h2 className={label}>Logged by month</h2>
            <div
              role="img"
              aria-label={`Games logged by month: ${review.loggedByMonth.map((games, i) => `${MONTHS[i]} ${games}`).join(", ")}`}
              className="flex min-h-0 flex-1 items-end gap-[1cqw]"
            >
              {MONTHS.map((month, i) => {
                const games = review.loggedByMonth[i] ?? 0;
                return (
                  <span
                    key={month}
                    className={`min-h-px flex-1 ${games === busiest ? "border border-keepsake-ink bg-keepsake-marker" : "bg-keepsake-ink"}`}
                    style={{ height: `${(games / busiest) * 100}%` }}
                  />
                );
              })}
            </div>
          </section>
          <section className={paper}>
            <h2 className="flex flex-1 flex-col justify-between">
              <span
                className={`${figure} leading-none`}
                style={{ fontSize: fit(playedCount, 9.5, 18.5) }}
              >
                {playedCount}
              </span>{" "}
              <span className={label}>
                {played.count === 1 ? "game" : "games"} played
              </span>
            </h2>
          </section>
          <section className={`${paper} justify-between`}>
            <p
              className={`${figure} leading-none`}
              style={{ fontSize: fit(hours, 9.5, 18.5) }}
            >
              {hours}
            </p>
            <h2 className={label}>Hours recorded</h2>
          </section>

          {played.count ? (
            <ul
              aria-label="Games played"
              className={`${box} col-span-3 flex items-center gap-[1.5cqw] bg-keepsake-paper`}
            >
              {played.games.slice(0, 5).map((game) => (
                <li key={game.gameId} className="w-[calc((100%-6cqw)/5)]">
                  <Link href={`/games/${game.slug}`} className={sheetLink}>
                    <GameCover
                      imageId={game.coverImageId}
                      className="w-full overflow-hidden rounded-sm [&>span]:hidden"
                    />
                    <span className="sr-only">{game.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${paper} ${label} col-span-3 justify-center`}>
              No dated Playthroughs in {review.year} yet.
            </p>
          )}
          <section className={`${paper} justify-between`}>
            <h2 className={label}>Top platform</h2>
            <p
              className="line-clamp-3 break-words font-medium leading-tight tracking-tight"
              style={{
                fontSize: `clamp(0.625rem, ${fit("x".repeat(platformWord), 3, 18.5)}, 1.125rem)`,
              }}
            >
              {review.topPlatform?.name ?? "None yet"}
            </p>
          </section>
        </div>
      </div>

      <div className="space-y-8 lg:col-start-2">
        {!hasGames ? (
          <section className="space-y-4">
            <h2 className={title}>A year still waiting to be recorded</h2>
            <p className="text-muted-foreground">
              Add a game, or open a game in your Library to record a dated
              Playthrough.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/" className={railLink}>
                Find a game
              </Link>
              <Link href="/library" className={railLink}>
                Open Library
              </Link>
            </div>
          </section>
        ) : (
          <section className="space-y-4" aria-labelledby="review-keepsake">
            <h2 id="review-keepsake" className={title}>
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
                onClick={(event) => {
                  if (busy.current) return;
                  setPointerPreview(event.detail > 0);
                  void prepare();
                }}
                loading={operation === "prepare"}
                disabled={pending}
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
                  loading={operation === "download"}
                  disabled={pending}
                  className="min-h-11"
                >
                  {failed ? "Retry download" : "Download PNG"}
                </Button>
              )}
            </div>
            <output
              aria-live="polite"
              className="text-muted-foreground text-sm"
            >
              {pending ? (
                <ActionFeedback state="pending">{message}</ActionFeedback>
              ) : (
                message
              )}
            </output>
            {image && (
              <figure
                className="preview-reveal max-w-md space-y-2"
                data-pointer-motion={pointerPreview}
                data-ready={loadedImage === image}
              >
                {/* biome-ignore lint/performance/noImgElement: the preview is the exact on-demand PNG blob, not a Next image asset. */}
                <img
                  src={image}
                  onLoad={() => setLoadedImage(image)}
                  onError={() => setLoadedImage(image)}
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
        {logged.count > 0 && (
          <section className="space-y-2 border-border border-t pt-6">
            <h2 className={title}>Latest games logged</h2>
            <ul className="divide-y divide-border">
              {logged.games.slice(0, 6).map((game) => (
                <li key={game.gameId}>
                  <Link
                    href={`/games/${game.slug}`}
                    className="flex min-h-11 items-center gap-3 rounded-md py-2 text-sm underline-offset-4 hover:underline focus-visible:outline-2"
                  >
                    <GameCover
                      imageId={game.coverImageId}
                      size="cover_small"
                      className="w-12 rounded-md"
                    />
                    <span className="min-w-0 break-words">{game.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {logged.count > Math.min(logged.games.length, 6) && (
              <p className="text-muted-foreground text-sm">
                {Math.min(logged.games.length, 6)} of {loggedCount} games
                logged.
              </p>
            )}
          </section>
        )}
        <section className="space-y-2 border-border border-t pt-6">
          <h2 className={title}>How these are counted</h2>
          <p className="text-muted-foreground text-sm">
            Games logged were added to your Journal this year, in any Status.
            Edits do not count as new additions. Removing or re-adding a game
            changes this review.
          </p>
          <p className="text-muted-foreground text-sm">
            Games played are based on recorded Playthrough date ranges
            overlapping this year through {review.through}, including open
            Playthroughs. Each game counts once. These games may also appear in
            Games logged; the totals are separate.
          </p>
          <p className="text-muted-foreground text-sm">
            Hours and Top platform come from those same Playthroughs. Hours are
            the totals you entered, including any time before this year on a
            Playthrough that carried over. Top platform is the one with the most
            games played.
          </p>
        </section>
      </div>
    </div>
  );
}
