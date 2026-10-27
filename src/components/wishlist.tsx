"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  ViewTransition,
} from "react";
import { GameCover } from "@/components/game-cover";
import { Odometer } from "@/components/odometer";
import { PagedList } from "@/components/paged-list";
import { Button } from "@/components/ui/button";
import type { Status, WishlistEntry } from "@/lib/journal";
import { capitalize } from "@/lib/library";
import { countdown, localDay, OUT_NOW, TODAY } from "@/lib/release-dates";

// Re-read the clock every minute so a Countdown ticks over at local midnight.
const everyMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};
const today = () =>
  localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

/** The user's local calendar day; null while rendering on the server, which doesn't know their time zone. */
const useToday = () => useSyncExternalStore(everyMinute, today, () => null);

type Destination = "backlog" | "playing";
/** Changes a game's Status if it's still as `from` says; resolves to the change's time (for undo), or null if it had changed meanwhile. */
type Move = (
  gameId: number,
  from: { status: Status; updatedAt?: Date },
  to: Status,
) => Promise<Date | null>;
type Moved = { entry: WishlistEntry; to: Destination; at: Date };
type Notice =
  | (Moved & {
      state: "moved" | "undoing" | "undo-failed" | "undo-conflict" | "undone";
    })
  // Changed elsewhere first; the refresh then drops its row, so the notice says why.
  | { entry: WishlistEntry; state: "move-conflict" };

const SECTIONS = [
  ["out", "Out now"],
  ["upcoming", "Upcoming"],
  ["tba", "Release date not announced"],
] as const;

/** Wishlisted games in Out now, Upcoming and unannounced sections, with a live Countdown; released ones offer an undoable move to Backlog or Playing. */
export function Wishlist({
  entries,
  onMove,
}: {
  entries: WishlistEntry[];
  onMove?: Move;
}) {
  const day = useToday();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [undoing, startUndo] = useTransition();
  const noticeRef = useRef<HTMLDivElement>(null);

  // The moved row leaves the list, so its focus goes to the notice that replaces it.
  useEffect(() => {
    if (notice?.state === "moved") noticeRef.current?.focus();
  }, [notice]);

  if (entries.length === 0 && !onMove)
    return (
      <p className="py-8 text-muted-foreground">
        No games on this wishlist yet.
      </p>
    );

  // Until the browser reports its time zone, sections follow the UTC day; Countdowns wait for the local one.
  const sectionDay = day ?? localDay(new Date(), "UTC");
  const section = (e: WishlistEntry) =>
    !e.release.date
      ? "tba"
      : countdown(e.release, sectionDay) === OUT_NOW
        ? "out"
        : "upcoming";

  const grouped: Record<string, WishlistEntry[]> = {
    out: [],
    upcoming: [],
    tba: [],
  };
  for (const entry of entries) grouped[section(entry)].push(entry);

  function undo(moved: Moved) {
    setNotice({ ...moved, state: "undoing" });
    startUndo(async () => {
      try {
        const back = await onMove?.(
          moved.entry.gameId,
          { status: moved.to, updatedAt: moved.at },
          "wishlist",
        );
        setNotice({ ...moved, state: back ? "undone" : "undo-conflict" });
      } catch {
        setNotice({ ...moved, state: "undo-failed" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {onMove && (
        // biome-ignore lint/a11y/useSemanticElements: <output> may only hold phrasing content; this holds paragraphs and buttons.
        <div
          ref={noticeRef}
          tabIndex={-1}
          role="status"
          aria-label="Wishlist updates"
          className="outline-none empty:hidden"
        >
          {notice && (
            <MoveNotice notice={notice} pending={undoing} onUndo={undo} />
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p className="font-medium">Your wishlist is empty.</p>
          <p className="text-muted-foreground text-sm">
            Find an upcoming game and set its status to Wishlist to count down
            to its release.
          </p>
          <Button render={<Link href="/" />} nativeButton={false}>
            Find a game
          </Button>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {entries.length} {entries.length === 1 ? "game" : "games"}
          </p>
          {SECTIONS.map(([key, label]) => {
            const games = grouped[key];
            if (!games.length) return null;
            return (
              <section key={key} aria-labelledby={`wishlist-${key}`}>
                <h2
                  id={`wishlist-${key}`}
                  className="flex items-baseline gap-2 font-semibold text-lg"
                >
                  {label}{" "}
                  <span className="font-normal text-muted-foreground text-sm tabular-nums">
                    {games.length}
                  </span>
                </h2>
                <PagedList items={games} label={label}>
                  {(visible) => (
                    <ul className="flex flex-col divide-y divide-border/60">
                      {visible.map((e) => (
                        <Row
                          key={e.gameId}
                          entry={e}
                          day={day}
                          onMove={onMove}
                          onMoved={(moved) =>
                            setNotice(
                              moved
                                ? { ...moved, state: "moved" }
                                : { entry: e, state: "move-conflict" },
                            )
                          }
                        />
                      ))}
                    </ul>
                  )}
                </PagedList>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function MoveNotice({
  notice,
  pending,
  onUndo,
}: {
  notice: Notice;
  pending: boolean;
  onUndo: (moved: Moved) => void;
}) {
  const title = notice.entry.title;
  const open = (
    <Link
      href={`/games/${notice.entry.slug}`}
      aria-label={`Open ${title}`}
      className="underline underline-offset-4"
    >
      Open it
    </Link>
  );
  if (notice.state === "move-conflict")
    return (
      <Box>
        <p role="alert">
          {title} isn’t on your Wishlist any more; its Status was changed
          elsewhere. {open} to see where it is now.
        </p>
      </Box>
    );
  const { to, state } = notice;
  return (
    <Box>
      {state === "undone" ? (
        <p>{title} is back on your Wishlist.</p>
      ) : state === "undo-conflict" ? (
        <p role="alert">
          {title} changed after the move, so it was left as is. {open} to set
          its Status.
        </p>
      ) : (
        <>
          <p className="min-w-0 flex-1">
            Moved {title} to {capitalize(to)}.{" "}
            <Link
              href={`/library?status=${to}`}
              aria-label={`Open ${capitalize(to)} in Library`}
              className="underline underline-offset-4"
            >
              View in Library
            </Link>
          </p>
          {state === "undo-failed" && (
            <p role="alert" className="w-full text-destructive">
              Couldn’t put {title} back on your Wishlist. Check your connection
              and try again.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-11 sm:pointer-fine:h-7"
            onClick={() => onUndo(notice)}
          >
            {pending
              ? "Undoing…"
              : state === "undo-failed"
                ? "Try again"
                : "Undo"}
          </Button>
        </>
      )}
    </Box>
  );
}

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="enter flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
    {children}
  </div>
);

function Row({
  entry,
  day,
  onMove,
  onMoved,
}: {
  entry: WishlistEntry;
  day: string | null;
  onMove?: Move;
  /** Null when the entry had already left the Wishlist. */
  onMoved: (moved: Moved | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<Destination | null>(null);
  const [failed, setFailed] = useState(false);
  const { release } = entry;
  const left = day && countdown(release, day);

  function move(to: Destination) {
    setTarget(to);
    setFailed(false);
    startTransition(async () => {
      try {
        const at = await onMove?.(entry.gameId, { status: "wishlist" }, to);
        onMoved(at ? { entry, to, at } : null);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <Link
        href={`/games/${entry.slug}`}
        className="group flex min-w-0 flex-1 basis-64 items-center gap-4 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ViewTransition
          name={`game-cover-${entry.gameId}`}
          default="none"
          share="cover-morph"
        >
          <GameCover
            imageId={entry.coverImageId}
            size="cover_small"
            className="w-14 rounded"
          />
        </ViewTransition>
        {/* The Countdown sits under the date on phones, on the right from sm up. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className="break-words font-medium group-hover:underline group-hover:underline-offset-4">
              {entry.title}
            </h3>
            <p className="text-muted-foreground text-sm tabular-nums">
              {release.label}
            </p>
          </div>
          {left && (
            <p
              className={`shrink-0 font-semibold tabular-nums sm:text-lg ${left === TODAY ? "text-primary sm:text-xl" : ""}`}
            >
              <Odometer text={left} />
            </p>
          )}
        </div>
      </Link>

      {left === OUT_NOW && onMove && (
        <div className="flex flex-wrap items-center gap-2 pl-18 sm:pl-0">
          <span className="text-muted-foreground text-sm">
            {pending && target
              ? `Moving ${entry.title} to ${capitalize(target)}…`
              : "Move to"}
          </span>
          {(["backlog", "playing"] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant="outline"
              disabled={pending}
              className="h-11 capitalize sm:pointer-fine:h-7"
              aria-label={`Move ${entry.title} to ${status}`}
              onClick={() => move(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      )}
      {failed && target && (
        <div
          role="alert"
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 pl-18 text-destructive text-sm"
        >
          <p>
            Couldn’t move {entry.title} to {capitalize(target)}. Check your
            connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-11 sm:pointer-fine:h-7"
            onClick={() => move(target)}
          >
            Try again
          </Button>
        </div>
      )}
    </li>
  );
}
