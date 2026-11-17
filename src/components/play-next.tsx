"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { trackEvent } from "@/components/analytics";
import { GameCover } from "@/components/game-cover";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  nextBatch,
  type PlayNextGame,
  type PlayNextRead,
  type PlayNextRequest,
  type PlayNextSave,
  type PlayNextSnapshot,
  playNextHref,
  shuffle,
} from "@/lib/play-next";

const suggestionGrid = "grid gap-6 md:grid-cols-3";
const suggestionCard =
  "grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3 md:grid-cols-1";

function SuggestionPlaceholders() {
  return (
    <div aria-hidden="true" className={suggestionGrid}>
      {[0, 1, 2].map((row) => (
        <div key={row} className={suggestionCard}>
          <Skeleton className="aspect-[264/374] w-16 rounded-lg md:w-full md:max-w-60 md:justify-self-center" />
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlayNextLoading() {
  return (
    <div className="flex flex-col gap-3">
      <output className="sr-only">Loading suggestions…</output>
      <div aria-hidden="true" className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-32" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <Skeleton className="h-17 w-full" />
        <Skeleton className="h-17 w-full" />
      </div>
      <Skeleton aria-hidden="true" className="h-11 w-full" />
      <Skeleton aria-hidden="true" className="h-5 w-32" />
      <Skeleton aria-hidden="true" className="h-7 w-40" />
      <SuggestionPlaceholders />
    </div>
  );
}

/** An account-scoped round; provider reads and writes are supplied by the authenticated route. */
export function PlayNext({
  owner,
  onRead,
  onSave,
  initialRequest = { platform: "", genre: "" },
}: {
  owner: string;
  onRead: PlayNextRead;
  onSave: PlayNextSave;
  initialRequest?: PlayNextRequest;
}) {
  const [request, setRequested] = useState<PlayNextRequest>(initialRequest);
  const [snapshot, setSnapshot] = useState<PlayNextSnapshot>();
  const [settledRequest, setSettledRequest] = useState<PlayNextRequest>();
  const [seen, setSeen] = useState<number[]>([]);
  const [visible, setVisible] = useState<PlayNextGame[]>([]);
  const [chosen, setChosen] = useState<PlayNextGame>();
  const [success, setSuccess] = useState<PlayNextGame>();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const needsFocus = useRef(false);
  const results = useRef<HTMLElement>(null);
  const platformControl = useRef<HTMLButtonElement>(null);
  const retainedFocus = useRef<Element | null>(null);
  const fallbackSeen = useRef<number[]>([]);
  const source = request.source ?? snapshot?.source ?? "backlog";
  const displayedSource = snapshot?.source;
  const stale = loading || request !== settledRequest;
  const returnTo = playNextHref({ ...request, source });
  const signIn = `/sign-in?${new URLSearchParams({ returnTo })}`;
  useEffect(() => {
    window.history.replaceState(null, "", returnTo);
  }, [returnTo]);

  useEffect(() => {
    const attempt = ++generation.current;
    setLoading(true);
    const previousRound = request.popular ? fallbackSeen.current : [];
    onRead(owner, request)
      .then((value) => {
        if (generation.current !== attempt) return;
        if (value.owner !== owner) {
          setAuthRequired(true);
          setSnapshot(undefined);
          setVisible([]);
          return;
        }
        if (results.current?.contains(document.activeElement))
          retainedFocus.current = document.activeElement;
        setSnapshot(value);
        setSettledRequest(request);
        const batch = nextBatch(value.games, previousRound);
        setVisible(batch);
        setSeen([...previousRound, ...batch.map((game) => game.id)]);
        const emptyMessage =
          value.source === "backlog" && !value.backlogCount
            ? "Your Backlog is clear."
            : value.source === "backlog" && !value.hasReleasedBacklog
              ? "No released games in your Backlog."
              : "No games match these filters.";
        setNotice(
          batch.length ? `${batch.length} suggestions loaded.` : emptyMessage,
        );
      })
      .catch(() => {
        if (generation.current === attempt)
          setError("Couldn’t load suggestions. Your filters are kept.");
      })
      .finally(() => {
        if (generation.current === attempt) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [owner, onRead, request]);

  useLayoutEffect(() => {
    const previous = retainedFocus.current;
    if (!loading) retainedFocus.current = null;
    if (
      needsFocus.current ||
      (previous &&
        (!previous.isConnected || !loading) &&
        document.activeElement === document.body)
    ) {
      needsFocus.current = false;
      const next = heading.current ?? platformControl.current;
      next?.focus({ preventScroll: true });
      if (previous && next) next.scrollIntoView({ block: "nearest" });
    }
  });

  const setRequest = useCallback((next: PlayNextRequest) => {
    ++generation.current;
    if (results.current?.contains(document.activeElement))
      retainedFocus.current = document.activeElement;
    setLoading(true);
    setNotice("");
    setError("");
    setSaveError("");
    setChosen(undefined);
    setSuccess(undefined);
    setRequested(next);
  }, []);
  const refresh = useCallback(
    () => setRequest({ ...request }),
    [request, setRequest],
  );
  // A background tab must recheck its actor and Journal before exposing stale personal choices.
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible" && !busy.current) refresh();
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [refresh]);

  function different(reshuffle = false) {
    if (!snapshot || stale || pending) return;
    const pool =
      reshuffle && source === "backlog"
        ? shuffle(snapshot.games)
        : snapshot.games;
    const batch = nextBatch(pool, reshuffle ? [] : seen);
    setVisible(batch);
    setSeen((previous) => [
      ...(reshuffle ? [] : previous),
      ...batch.map((game) => game.id),
    ]);
    setNotice(`${batch.length} different suggestions shown.`);
    trackEvent("play_next_action", {
      source,
      action: reshuffle ? "reshuffle" : "reroll",
    });
  }

  async function save(game: PlayNextGame, status: "backlog" | "playing") {
    if (busy.current || stale) return;
    busy.current = true;
    setPending(true);
    setSaveError("");
    const attempt = generation.current;
    try {
      const result = await onSave(owner, game, status);
      if (attempt !== generation.current) return;
      if (result.authRequired) {
        setAuthRequired(true);
        setSnapshot(undefined);
        setVisible([]);
        setChosen(undefined);
        return;
      }
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      setNotice(
        `${game.title}${status === "playing" ? ": Status set to Playing. No Playthrough was added." : " saved to Backlog."}`,
      );
      trackEvent("play_next_action", {
        source,
        action: status === "playing" ? "started" : "saved",
      });
      setSnapshot((previous) =>
        previous
          ? {
              ...previous,
              games: previous.games.filter(
                (candidate) => candidate.id !== game.id,
              ),
            }
          : previous,
      );
      setVisible((previous) =>
        previous.filter((candidate) => candidate.id !== game.id),
      );
      if (status === "playing") {
        setSuccess(game);
        setChosen(undefined);
      }
      needsFocus.current = true;
    } catch {
      setSaveError(
        "Couldn’t confirm the save. Your choice is kept. Try again, or reload suggestions to check your Journal.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (authRequired)
    return (
      <div className="space-y-3">
        <p>
          Your session changed. Reload to use the current account, or sign in to
          continue.
        </p>
        <Link href={signIn} className="underline">
          Sign in to continue
        </Link>
        <Button onClick={() => window.location.reload()}>
          Reload suggestions
        </Button>
      </div>
    );
  const unseen = snapshot?.games.some((game) => !seen.includes(game.id));
  const emptyBacklog =
    displayedSource === "backlog" && snapshot?.backlogCount === 0;
  const noReleased =
    displayedSource === "backlog" &&
    !emptyBacklog &&
    !snapshot?.hasReleasedBacklog;
  const exhausted =
    !!snapshot && !emptyBacklog && !!snapshot?.games.length && !unseen;
  const options = {
    platform: [
      ...new Set([
        ...(snapshot?.platforms ?? []),
        "PC (Microsoft Windows)",
        "PlayStation 5",
        "Xbox Series X|S",
        "Nintendo Switch",
        "Nintendo Switch 2",
        ...(request.platform ? [request.platform] : []),
      ]),
    ].sort(),
    genre: [
      ...new Set([
        ...(snapshot?.genres ?? []),
        "Adventure",
        "Role-playing (RPG)",
        "Shooter",
        "Platform",
        "Puzzle",
        "Strategy",
        "Indie",
        ...(request.genre ? [request.genre] : []),
      ]),
    ].sort(),
  };
  return (
    <div className="flex flex-col gap-3">
      {!success && (
        <>
          <fieldset
            aria-label="Suggestion source"
            disabled={pending}
            className="flex flex-wrap gap-2"
          >
            {(
              [
                ["backlog", "My Backlog"],
                ["discover", "Discover games"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                className="h-auto min-h-11 whitespace-normal"
                aria-pressed={source === value}
                variant={source === value ? "default" : "outline"}
                onClick={() =>
                  setRequest({ ...request, source: value, popular: false })
                }
              >
                {label}
              </Button>
            ))}
          </fieldset>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3">
            {(
              [
                ["platform", "Available on", "Any platform"],
                ["genre", "Genre", "Any genre"],
              ] as const
            ).map(([key, label, any]) => {
              const items = [
                { value: "", label: any },
                ...options[key].map((value) => ({ value, label: value })),
              ];
              return (
                <Field key={key} className="min-w-0">
                  <FieldLabel htmlFor={`play-next-${key}`}>{label}</FieldLabel>
                  <Select
                    value={request[key]}
                    items={items}
                    disabled={pending}
                    onValueChange={(value) =>
                      setRequest({
                        ...request,
                        [key]: value ?? "",
                        source,
                        popular: false,
                      })
                    }
                  >
                    <SelectTrigger
                      ref={key === "platform" ? platformControl : undefined}
                      id={`play-next-${key}`}
                      className="min-h-11 w-full"
                    >
                      <SelectValue className="truncate" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-[1_1_8rem] text-muted-foreground text-xs">
              Platform support only. Ownership and subscriptions may vary.
            </p>
            <Button
              variant="ghost"
              className="h-auto min-h-11 shrink-0 whitespace-normal"
              disabled={pending || !(request.platform || request.genre)}
              onClick={() => setRequest({ source, platform: "", genre: "" })}
            >
              Clear filters
            </Button>
          </div>
        </>
      )}
      <section
        ref={results}
        aria-label="Suggestions"
        className="flex flex-col gap-3"
      >
        <output
          aria-label="Play next updates"
          className="flex min-h-5 items-center text-muted-foreground text-sm"
        >
          {loading ? (
            <ActionFeedback state="pending">
              {snapshot
                ? "Updating previous suggestions…"
                : "Loading suggestions…"}
            </ActionFeedback>
          ) : (
            notice
          )}
        </output>
        {success ? (
          <div className="space-y-4">
            <h2 ref={heading} tabIndex={-1} className="font-semibold text-xl">
              {success.title}
            </h2>
            <Button
              onClick={() => {
                setSuccess(undefined);
                needsFocus.current = true;
              }}
            >
              Back to suggestions
            </Button>
            <Link href={`/games/${success.slug}`} className="ml-3 underline">
              Open game
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="space-y-3">
                <p>
                  {error}
                  {snapshot && " Showing previous suggestions."}
                </p>
                <Button onClick={refresh}>Retry</Button>
              </div>
            )}
            {loading && !snapshot && (
              <>
                <Skeleton aria-hidden="true" className="h-7 w-40" />
                <SuggestionPlaceholders />
              </>
            )}
            {snapshot && (
              <>
                <h2
                  ref={heading}
                  tabIndex={-1}
                  className="font-semibold text-xl"
                >
                  {emptyBacklog
                    ? "Your Backlog is clear"
                    : noReleased
                      ? "No released games in your Backlog"
                      : visible.length
                        ? snapshot?.provenance === "popular"
                          ? "Popular games"
                          : displayedSource === "backlog"
                            ? "From your Backlog"
                            : "Related to your Backlog"
                        : exhausted || seen.length
                          ? "You’ve seen every match"
                          : "No games match these filters"}
                </h2>
                {snapshot?.provenance === "popular" && (
                  <p className="text-muted-foreground text-sm">
                    Widely rated released games.{" "}
                    {snapshot.backlogCount
                      ? "No more related matches in this pool."
                      : "Save games to your Backlog to get related suggestions."}
                  </p>
                )}
                {(emptyBacklog || noReleased) && (
                  <Button
                    disabled={pending || stale}
                    className="self-start"
                    onClick={() =>
                      setRequest({ ...request, source: "discover" })
                    }
                  >
                    Discover games
                  </Button>
                )}
                {!visible.length && !emptyBacklog && !noReleased && (
                  <p className="text-muted-foreground">
                    {seen.length
                      ? "Start a fresh round or try other filters."
                      : "Try another platform or genre, or clear your filters."}
                  </p>
                )}
                <div className={suggestionGrid}>
                  {visible.map((game) => (
                    <article
                      key={game.id}
                      aria-label={game.title}
                      className={suggestionCard}
                    >
                      <GameCover
                        imageId={game.coverImageId}
                        className="w-16 rounded-lg shadow-lg [&_span]:hidden md:w-full md:max-w-60 md:justify-self-center md:[&_span]:block"
                      />
                      <div className="flex min-w-0 flex-col gap-3">
                        <h3 className="font-semibold text-lg [overflow-wrap:anywhere]">
                          <Link
                            className="underline-offset-4 hover:underline"
                            href={`/games/${game.slug}`}
                          >
                            {game.title}
                          </Link>
                        </h3>
                        {(game.year || game.genres.length > 0) && (
                          <p className="text-muted-foreground text-sm">
                            {[game.year, game.genres.slice(0, 2).join(", ")]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        {!!game.platforms.length && (
                          <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
                            Available on{" "}
                            {settledRequest?.platform ||
                              game.platforms.join(", ")}
                          </p>
                        )}
                        <p className="text-sm">{game.reason}</p>
                        <Button
                          aria-label={`Choose this for ${game.title}`}
                          disabled={pending || stale}
                          onClick={(event) => {
                            trigger.current = event.currentTarget;
                            setChosen(game);
                            setSaveError("");
                          }}
                        >
                          Choose this
                        </Button>
                        {displayedSource === "discover" && (
                          <Button
                            variant="outline"
                            aria-label={`Save to Backlog for ${game.title}`}
                            loading={pending}
                            disabled={pending || stale}
                            onClick={() => save(game, "backlog")}
                          >
                            Save to Backlog
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {saveError && !chosen && (
                  <div role="alert">
                    <p>{saveError}</p>
                    <Button variant="outline" onClick={refresh}>
                      Reload suggestions
                    </Button>
                  </div>
                )}
                {exhausted && visible.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    You’ve seen every match in this round. Reshuffle to revisit
                    them.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {unseen && (
                    <Button
                      variant="outline"
                      disabled={pending || stale}
                      onClick={() => different()}
                    >
                      Show different games
                    </Button>
                  )}
                  {(exhausted || (!visible.length && seen.length > 0)) && (
                    <Button
                      variant="outline"
                      disabled={pending || stale}
                      onClick={() => different(true)}
                    >
                      Reshuffle games
                    </Button>
                  )}
                  {!unseen &&
                    displayedSource === "discover" &&
                    snapshot?.provenance === "related" && (
                      <Button
                        variant="outline"
                        disabled={pending || stale}
                        onClick={() => {
                          fallbackSeen.current = seen;
                          setRequest({ ...request, source, popular: true });
                        }}
                      >
                        Show popular games
                      </Button>
                    )}
                  <Button
                    variant="ghost"
                    aria-disabled={pending || loading}
                    onClick={() => {
                      if (!pending && !loading) refresh();
                    }}
                  >
                    Reload suggestions
                  </Button>
                </div>
                {snapshot?.bounded && (
                  <p className="text-muted-foreground text-sm">
                    This is a limited selection from the Catalog. Other matches
                    may exist.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>
      <Drawer
        open={!!chosen}
        onOpenChange={(open) => {
          if (!open && !busy.current) setChosen(undefined);
        }}
      >
        <DrawerContent
          finalFocus={() => (success ? heading.current : trigger.current)}
        >
          <DrawerHeader>
            <DrawerTitle>Start playing {chosen?.title}?</DrawerTitle>
            <DrawerDescription>
              Confirming sets the Status of {chosen?.title} to Playing. You can
              add a Playthrough separately.
            </DrawerDescription>
          </DrawerHeader>
          {saveError && (
            <p role="alert" className="px-4 text-destructive">
              {saveError}
            </p>
          )}
          <DrawerFooter>
            <Button
              disabled={pending || stale}
              loading={pending}
              onClick={() => chosen && save(chosen, "playing")}
            >
              Set Status to Playing
            </Button>
            <DrawerClose
              render={<Button variant="outline" disabled={pending} />}
            >
              Cancel
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
