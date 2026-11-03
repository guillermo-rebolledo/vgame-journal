import Link from "next/link";
import type { ReactNode } from "react";
import { GameCover } from "@/components/game-cover";
import { HomeCoverLink } from "@/components/home-cover-link";
import { buttonVariants } from "@/components/ui/button";
import { capitalize, type LibraryEntry } from "@/lib/library";

/** Entries arrive in the Journal's canonical addition order, without private notes. */
export function HomeJournal({
  entries,
  wishlistPreview,
}: {
  entries: LibraryEntry[];
  wishlistPreview?: ReactNode;
}) {
  const playing = entries
    .filter((entry) => entry.status === "playing")
    .slice(0, 4);
  const recent = entries.slice(0, 4);
  return (
    <div className="mt-2 flex flex-col gap-6 border-t pt-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["/library", "All saved games", entries.length],
              [
                "/library?status=backlog",
                "Backlog",
                entries.filter((e) => e.status === "backlog").length,
              ],
              [
                "/wishlist",
                "Wishlist",
                entries.filter((e) => e.status === "wishlist").length,
              ],
            ] as const
          ).map(([href, label, count]) => (
            <Link
              key={href}
              href={href}
              className={buttonVariants({
                variant: "outline",
                className: "min-h-11 h-auto whitespace-normal py-2",
              })}
            >
              {label} ({count})
            </Link>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          All saved games are in Library. Backlog and Wishlist are Status groups
          within it.
        </p>
        {wishlistPreview}
      </div>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">
          Your Journal is empty. Search above, open a game, and set its Status
          to add it.
        </p>
      ) : (
        <>
          {playing.length > 0 && (
            <PersonalShelf
              title="Playing"
              games={playing}
              href="/library?status=playing"
            />
          )}
          <PersonalShelf
            title="Recently added"
            games={recent}
            href="/library?sort=added"
          />
        </>
      )}
    </div>
  );
}

function PersonalShelf({
  title,
  games,
  href,
}: {
  title: string;
  games: LibraryEntry[];
  href: string;
}) {
  const id = `home-${title.toLowerCase().replace(/ /g, "-")}`;
  const compact = games.length <= 2;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 id={id} className="font-semibold text-xl">
          {title}
        </h2>
        <Link
          href={href}
          aria-label={`View all ${title} games`}
          className="inline-flex min-h-11 items-center rounded-md text-sm underline underline-offset-4"
        >
          View all
        </Link>
      </div>
      <ul
        className={
          compact
            ? "flex flex-col gap-3"
            : "grid grid-cols-2 gap-4 sm:grid-cols-4"
        }
      >
        {games.map((entry) => (
          <li key={entry.gameId} className="min-w-0">
            <HomeCoverLink
              gameId={entry.gameId}
              source="shelf"
              href={`/games/${entry.slug}`}
              className={`group flex gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${compact ? "items-center" : "flex-col"}`}
              cover={
                <GameCover
                  imageId={entry.coverImageId}
                  size={compact ? "cover_small" : undefined}
                  className={
                    compact ? "w-12 rounded" : "w-full rounded-lg shadow-lg"
                  }
                />
              }
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="break-words font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
                  {entry.title}
                </span>{" "}
                <span className="text-muted-foreground text-sm">
                  {capitalize(entry.status)}
                </span>
              </div>
            </HomeCoverLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
