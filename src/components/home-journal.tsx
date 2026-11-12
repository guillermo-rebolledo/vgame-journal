"use client";

import { cn } from "cn";
import {
  BookMarked,
  BookPlus,
  Check,
  ChevronDown,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  homeIntentGame,
  readHomeJournal,
  saveHomeStatus,
} from "@/app/home-actions";
import { HomeCollectionsLoading } from "@/components/content-loading";
import {
  FeedbackLink,
  useFeedbackChannel,
} from "@/components/feedback-channel";
import { GameCover } from "@/components/game-cover";
import { HomeCoverLink } from "@/components/home-cover-link";
import { HomeWishlistPreview } from "@/components/home-wishlist-preview";
import { SteamImportInvitation } from "@/components/steam-import-invitation";
import { ActionIcon, type ActionState } from "@/components/ui/action-feedback";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { authPageHref } from "@/lib/auth-continuation";
import {
  type HomeEntry,
  type HomeSnapshot,
  SAVED_LABELS,
} from "@/lib/home-journal";
import { byTitle, capitalize, STATUSES, type Status } from "@/lib/library";
import { compareWishlist } from "@/lib/release-dates";

type Game = { gameId: number; slug: string; title: string };
type Intent = Game & { status: Status };
type SaveState = {
  status: Status;
  feedback?: { message: string; confirmed: boolean };
  pending?: boolean;
  error?: string;
  authRequired?: boolean;
};
type HomeState = {
  notice: string;
  clearFeedback: () => void;
  setFeedbackHosts: Dispatch<SetStateAction<number>>;
  snapshot: HomeSnapshot;
  loaded: boolean;
  byGame: Map<number, HomeEntry>;
  continuation: ReactNode;
  saves: Record<number, SaveState>;
  save: (game: Game, status: Status) => Promise<boolean>;
  retry: () => void;
};
const HomeContext = createContext<HomeState | null>(null);

function runAction<T>(action: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await action());
      } catch (error) {
        reject(error);
      }
    });
  });
}

function focusHomeGame(gameId?: number) {
  const visible = (element: HTMLElement) =>
    !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    (element.checkVisibility?.() ?? true);
  const control = gameId
    ? Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          `[data-home-game="${gameId}"] button`,
        ),
      ).find(visible)
    : null;
  (
    control ??
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"] input[type="search"], .home-journal [role="combobox"][type="search"], .home-journal [data-catalog-trigger], .home-journal search input[type="search"]',
      ),
    ).find(visible)
  )?.focus({ preventScroll: true });
}

function replaceHomeUrl(intent: Intent | null) {
  const url = new URL(window.location.href);
  for (const key of ["saveGame", "saveSlug", "saveStatus"])
    url.searchParams.delete(key);
  if (intent) {
    url.searchParams.set("saveGame", String(intent.gameId));
    url.searchParams.set("saveSlug", intent.slug);
    url.searchParams.set("saveStatus", intent.status);
  }
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

export function HomeJournalProvider({
  owner,
  initial,
  children,
}: {
  owner: string | null;
  initial: Promise<HomeSnapshot>;
  children: ReactNode;
}) {
  const feedbackChannel = useFeedbackChannel();
  const router = useRouter();
  const params = useSearchParams();
  const [source, setSource] = useState(initial);
  const [snapshot, setSnapshot] = useState<HomeSnapshot>({
    owner,
    entries: owner ? null : [],
  });
  const [loaded, setLoaded] = useState(!owner);
  const [saves, setSaves] = useState<Record<number, SaveState>>({});
  const [notice, setNotice] = useState("");
  const [feedbackHosts, setFeedbackHosts] = useState(0);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [focusAfterSave, setFocusAfterSave] = useState<Intent | null>(null);
  const [intentFailed, setIntentFailed] = useState(false);
  const promptRef = useRef<HTMLElement | null>(null);
  const focusIntent = useRef(false);
  const locks = useRef(new Set<number>());
  const version = useRef(0);
  const activeOwner = useRef(snapshot.owner);
  activeOwner.current = snapshot.owner;
  const clearFeedback = useCallback(() => {
    setNotice("");
    setSaves((old) =>
      Object.fromEntries(
        Object.entries(old).map(([id, state]) => [
          id,
          { ...state, feedback: undefined },
        ]),
      ),
    );
  }, []);
  const saveGame = params.get("saveGame");
  const saveSlug = params.get("saveSlug");
  const saveStatus = params.get("saveStatus");

  if (source !== initial) {
    if (snapshot.owner !== owner) {
      setSaves({});
      setNotice("");
    }
    setSource(initial);
    setSnapshot({ owner, entries: owner ? null : [] });
    setLoaded(!owner);
  }

  useEffect(() => {
    let active = true;
    initial.then((value) => {
      if (active) {
        setSnapshot(value);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [initial]);

  useEffect(() => {
    let active = true;
    setIntent(null);
    setIntentFailed(false);
    if (
      !saveGame ||
      !/^[1-9]\d*$/.test(saveGame) ||
      !saveSlug ||
      !STATUSES.includes(saveStatus as Status)
    )
      return;
    startTransition(async () => {
      try {
        const game = await homeIntentGame(Number(saveGame), saveSlug);
        if (active) {
          if (game) setIntent({ ...game, status: saveStatus as Status });
          else setIntentFailed(true);
        }
      } catch {
        if (active) setIntentFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [saveGame, saveSlug, saveStatus]);

  function accept(value: HomeSnapshot) {
    activeOwner.current = value.owner;
    setSnapshot(value);
    setLoaded(true);
    if (value.owner !== owner) {
      setSaves({});
      router.refresh();
    }
  }
  async function retry() {
    const attempt = ++version.current;
    setLoaded(false);
    try {
      const value = await runAction(readHomeJournal);
      if (version.current === attempt) accept(value);
    } catch {
      if (version.current === attempt)
        setSnapshot((old) => ({ ...old, entries: null }));
    } finally {
      if (version.current === attempt) setLoaded(true);
    }
  }
  async function save(game: Game, status: Status) {
    if (locks.current.has(game.gameId)) return false;
    if (!snapshot.owner) {
      if (intent?.gameId === game.gameId && intent.status === status) {
        promptRef.current?.querySelector<HTMLElement>("a, button")?.focus();
      } else {
        focusIntent.current = true;
        replaceHomeUrl({ ...game, status });
      }
      return false;
    }
    if (!snapshot.entries) return false;
    function report(message: string, confirmed = false) {
      setNotice(message);
      setSaves((old) => ({
        ...old,
        [game.gameId]: {
          ...old[game.gameId],
          feedback: { message, confirmed },
        },
      }));
    }
    const expectedOwner = snapshot.owner;
    locks.current.add(game.gameId);
    ++version.current;
    setSaves((old) => ({ ...old, [game.gameId]: { status, pending: true } }));
    report(`Saving ${game.title} to ${capitalize(status)}…`);
    try {
      let result: Awaited<ReturnType<typeof saveHomeStatus>>;
      try {
        result = await runAction(() =>
          saveHomeStatus(expectedOwner, game.gameId, game.slug, status),
        );
      } catch {
        const persisted = await runAction(readHomeJournal).catch(() => null);
        result = {
          snapshot: persisted ?? { owner: snapshot.owner, entries: null },
          error:
            "The connection was interrupted. Check the confirmed status below, then retry if needed.",
        };
      }
      if (activeOwner.current !== expectedOwner) return false;
      if (
        result.snapshot.owner !== snapshot.owner ||
        ("authRequired" in result && result.authRequired)
      ) {
        accept({ owner: result.snapshot.owner, entries: null });
        setSaves((old) => ({
          ...old,
          [game.gameId]: {
            status,
            authRequired: true,
            error:
              "Your session changed. Sign in to continue; nothing is confirmed saved.",
          },
        }));
        report(`${game.title}: sign in to continue saving.`);
        replaceHomeUrl({ ...game, status });
        return false;
      }
      // Keep the last confirmed projection if reconciliation itself is unavailable.
      if (result.snapshot.entries) {
        const entry = result.snapshot.entries.find(
          (e) => e.gameId === game.gameId,
        );
        // Another game's response may have arrived since this snapshot was read.
        setSnapshot((old) => {
          if (old.owner !== expectedOwner) return old;
          const others =
            old.entries?.filter((e) => e.gameId !== game.gameId) ?? [];
          return {
            ...old,
            entries: (entry ? [entry, ...others] : others).sort(
              (a, b) =>
                b.addedAt.getTime() - a.addedAt.getTime() || byTitle(a, b),
            ),
          };
        });
      }
      const confirmed =
        result.snapshot.entries?.find((e) => e.gameId === game.gameId)
          ?.status === status;
      if (confirmed) {
        setSaves((old) => ({ ...old, [game.gameId]: { status } }));
        report(`${game.title} saved to ${capitalize(status)}.`, true);
        if ("feedbackInvitation" in result && result.feedbackInvitation)
          feedbackChannel?.saved();
        return true;
      }
      setSaves((old) => ({
        ...old,
        [game.gameId]: {
          status,
          error:
            "error" in result
              ? result.error
              : "Couldn’t confirm the save. Try again.",
          ...(!result.snapshot.entries
            ? {
                error:
                  "Couldn’t check the save outcome. Retry to reconcile your Journal before saving again.",
              }
            : {}),
        },
      }));
      report(`${game.title}: save not confirmed.`);
      return false;
    } finally {
      locks.current.delete(game.gameId);
    }
  }
  useEffect(() => {
    if (intent && focusIntent.current) {
      focusIntent.current = false;
      promptRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    }
  }, [intent]);
  useLayoutEffect(() => {
    if (
      !focusAfterSave ||
      intent ||
      saves[focusAfterSave.gameId]?.pending ||
      snapshot.entries?.find((e) => e.gameId === focusAfterSave.gameId)
        ?.status !== focusAfterSave.status
    )
      return;
    focusHomeGame(focusAfterSave.gameId);
    setFocusAfterSave(null);
  }, [focusAfterSave, intent, saves, snapshot]);
  const returnTo = `/${params.size ? `?${params}` : ""}`;
  const continuation = (intent || intentFailed) && (
    <section
      ref={promptRef}
      aria-label="Pending Journal save"
      className="order-none flex flex-col gap-3 rounded-lg border p-4"
    >
      {intent ? (
        <>
          <h2 className="font-semibold">
            Save {intent.title} to {capitalize(intent.status)}?
          </h2>
          {!snapshot.owner ? (
            <>
              <p>
                Sign in or create an account to save this game. You’ll confirm
                this action after signing in.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  className={buttonVariants({
                    variant: "outline",
                    className: "min-h-11",
                  })}
                  href={authPageHref("/sign-in", returnTo)}
                >
                  Sign in to continue
                </Link>
                <Link
                  className={buttonVariants({
                    variant: "outline",
                    className: "min-h-11",
                  })}
                  href={authPageHref("/sign-up", returnTo)}
                >
                  Create an account to continue
                </Link>
              </div>
            </>
          ) : !loaded ? (
            <p className="flex items-center gap-2">
              <Spinner />
              <span className="shimmer">Checking your Journal…</span>
            </p>
          ) : !snapshot.entries ? (
            <>
              <p>Your Journal status is unavailable.</p>
              <Button onClick={retry}>Retry Journal</Button>
            </>
          ) : (
            <>
              <p>
                Current status:{" "}
                {SAVED_LABELS[
                  snapshot.entries.find((e) => e.gameId === intent.gameId)
                    ?.status as Status
                ] ?? "Not in your Journal"}
                . Confirm to{" "}
                {snapshot.entries.some((e) => e.gameId === intent.gameId)
                  ? "change its status"
                  : "add it to your Journal"}
                .
              </p>
              <Button
                className="min-h-11 self-start"
                loading={saves[intent.gameId]?.pending}
                onClick={async () => {
                  if (await save(intent, intent.status)) {
                    setIntent(null);
                    replaceHomeUrl(null);
                    setFocusAfterSave(intent);
                  }
                }}
              >
                Confirm {intent.title} to {capitalize(intent.status)}
              </Button>
              {saves[intent.gameId]?.error && (
                <p>{saves[intent.gameId].error}</p>
              )}
            </>
          )}
        </>
      ) : (
        <p>This pending game could not be loaded. Search for it again.</p>
      )}
      <Button
        variant="ghost"
        className="min-h-11 self-start"
        onClick={() => {
          setIntent(null);
          setIntentFailed(false);
          replaceHomeUrl(null);
          focusHomeGame();
        }}
      >
        Cancel pending save
      </Button>
    </section>
  );
  const context: HomeState = {
    notice,
    clearFeedback,
    setFeedbackHosts,
    snapshot,
    loaded,
    byGame: new Map(snapshot.entries?.map((entry) => [entry.gameId, entry])),
    continuation,
    saves,
    save,
    retry,
  };
  return (
    <HomeContext value={context}>
      <div className="home-journal contents">
        {children}
        <output
          hidden={feedbackHosts > 0}
          aria-label="Journal updates"
          aria-live="polite"
          className="sr-only"
        >
          {notice}
        </output>
      </div>
    </HomeContext>
  );
}

export function HomePendingSave({
  children,
}: {
  children?: (continuation: ReactNode) => ReactNode;
}) {
  const continuation = useContext(HomeContext)?.continuation;
  return children ? children(continuation) : continuation;
}

/** Search owns announcements while open; preserve confirmed feedback across host changes. */
export function HomeJournalFeedback({ gameId }: { gameId?: number }) {
  const home = useContext(HomeContext);
  const setHosts = home?.setFeedbackHosts;
  useEffect(() => {
    setHosts?.((count) => count + 1);
    return () => {
      setHosts?.((count) => count - 1);
    };
  }, [setHosts]);
  return (
    <output
      aria-label="Journal updates"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {gameId === undefined
        ? home?.notice
        : home?.saves[gameId]?.feedback?.message}
    </output>
  );
}

export function HomeSaveControls({
  game,
  presentation = "compact",
  announce = true,
}: {
  game: Game;
  announce?: boolean;
  presentation?: "compact" | "direct";
}) {
  const home = useContext(HomeContext);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const errorId = useId();
  const clear = home?.clearFeedback;
  useEffect(() => {
    if (presentation !== "direct" || announce) return;
    clear?.();
    return () => clear?.();
  }, [clear, presentation, announce]);
  if (!home) return null;
  const { snapshot, saves } = home;
  const entry = home.byGame.get(game.gameId);
  const state = saves[game.gameId];
  const unavailable = !!snapshot.owner && !snapshot.entries;
  const busy = state?.pending;
  const loading = unavailable;
  const saved =
    !busy &&
    !state?.error &&
    state?.feedback?.confirmed &&
    state.status === entry?.status;
  function actionState(status?: Status): ActionState {
    if (status && state?.status !== status) return "idle";
    if (busy) return "pending";
    if (state?.error) return "error";
    return saved ? "success" : "idle";
  }
  async function choose(status: Status) {
    const focused = document.activeElement;
    const result = home?.save(game, status);
    if (presentation === "direct") {
      requestAnimationFrame(() => {
        if (!focused?.isConnected && document.activeElement === document.body)
          trigger.current?.focus({ preventScroll: true });
      });
    }
    const done = await result;
    if (done && presentation === "compact") {
      // Shelf membership can remove the old trigger; restore focus after that DOM update.
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (
          active !== document.body &&
          active !== focused &&
          active !== trigger.current
        )
          return;
        if (trigger.current?.isConnected)
          trigger.current.focus({ preventScroll: true });
        else focusHomeGame(game.gameId);
      });
    }
  }

  return (
    <div
      data-home-game={game.gameId}
      className={`mt-2 flex min-w-0 flex-col gap-2 text-sm [overflow-wrap:anywhere]${presentation === "direct" ? " w-full max-w-xl" : ""}`}
    >
      {presentation === "direct" && announce && (
        <HomeJournalFeedback gameId={game.gameId} />
      )}
      {presentation === "direct" ? (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 font-medium">Journal status</legend>
          <p className="flex items-start gap-2">
            {entry && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
            {unavailable
              ? "Current status unavailable"
              : entry
                ? `Current status: ${capitalize(entry.status)}`
                : "Not in your Journal"}
          </p>
          {!snapshot.owner && (
            <p>Sign in to save. You’ll confirm your choice after signing in.</p>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2">
            {(["backlog", "wishlist", "playing", "played"] as const).map(
              (status) => (
                <Button
                  key={status}
                  ref={state?.status === status ? trigger : undefined}
                  variant="outline"
                  press="static"
                  className="min-h-11 transition-none"
                  aria-disabled={busy || loading}
                  aria-busy={!!busy}
                  aria-describedby={state?.error ? errorId : undefined}
                  onClick={() => {
                    if (!busy && !loading) choose(status);
                  }}
                >
                  <ActionIcon icon={<BookPlus />} state={actionState(status)} />
                  <span
                    className={
                      actionState(status) === "pending" ? "shimmer" : undefined
                    }
                  >
                    Save to {capitalize(status)}
                  </span>
                </Button>
              ),
            )}
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-wrap gap-2">
          <DropdownMenu
            onOpenChange={(open, event) => {
              if (open && (!entry || busy || loading)) event.cancel();
            }}
          >
            <DropdownMenuTrigger
              {...(!entry
                ? { "aria-haspopup": undefined, "aria-expanded": undefined }
                : {})}
              render={
                <Button
                  ref={trigger}
                  press={entry ? "static" : "scale"}
                  variant="outline"
                  className="min-h-11 max-w-full"
                  aria-label={
                    entry
                      ? `${SAVED_LABELS[entry.status]} — Change status for ${game.title}`
                      : `Add to backlog for ${game.title}`
                  }
                  aria-disabled={busy || loading}
                  aria-busy={!!busy}
                  aria-describedby={state?.error ? errorId : undefined}
                  onClick={() => {
                    if (!entry && !busy && !loading) choose("backlog");
                  }}
                />
              }
            >
              <ActionIcon
                icon={entry ? <BookMarked fill="currentColor" /> : <BookPlus />}
                state={actionState(entry ? undefined : "backlog")}
              />
              <span
                className={
                  actionState(entry ? undefined : "backlog") === "pending"
                    ? "shimmer"
                    : undefined
                }
              >
                {entry ? SAVED_LABELS[entry.status] : "Add to backlog"}
              </span>
              {entry && (
                <ChevronDown aria-hidden="true" data-icon="inline-end" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="home-journal-menu w-60 max-w-[calc(100vw-2rem)] [overflow-wrap:anywhere]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status for {game.title}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={entry?.status ?? ""}>
                  {STATUSES.map((status) => (
                    <DropdownMenuRadioItem
                      key={status}
                      value={status}
                      closeOnClick
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => choose(status)}
                    >
                      {capitalize(status)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {!entry && (
            <Button
              variant="outline"
              className="min-h-11"
              aria-label={`Add to wishlist for ${game.title}`}
              aria-describedby={state?.error ? errorId : undefined}
              aria-disabled={busy || loading}
              onClick={() => {
                if (!busy && !loading) choose("wishlist");
              }}
            >
              <ActionIcon icon={<BookPlus />} state={actionState("wishlist")} />
              <span
                className={
                  actionState("wishlist") === "pending" ? "shimmer" : undefined
                }
              >
                Add to wishlist
              </span>
            </Button>
          )}
        </div>
      )}
      {unavailable && (
        <>
          <p className="flex items-center gap-2">
            {!home.loaded && <Spinner />}
            <span className={cn(!home.loaded && "shimmer")}>
              {home.loaded
                ? "Journal status unavailable."
                : "Checking Journal status…"}
            </span>
          </p>
          <Button
            variant="ghost"
            className="min-h-11 self-start"
            onClick={home.retry}
            aria-label={`Retry Journal for ${game.title}`}
            disabled={!home.loaded}
          >
            <RotateCw aria-hidden="true" />
            Retry Journal
          </Button>
        </>
      )}
      {state?.error && (
        <div>
          <p id={errorId}>
            {game.title}: {state.error}
          </p>
          {state.authRequired ? (
            <Link
              className="inline-flex min-h-11 items-center underline"
              href={authPageHref(
                "/sign-in",
                typeof window === "undefined"
                  ? "/"
                  : `${window.location.pathname}${window.location.search}`,
              )}
            >
              Sign in to save {game.title}
            </Link>
          ) : (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => choose(state.status)}
              aria-label={`Retry ${game.title} to ${capitalize(state.status)}`}
            >
              <RotateCw aria-hidden="true" />
              Retry {capitalize(state.status)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function HomeCollections({
  steamImportEnabled = false,
}: {
  steamImportEnabled?: boolean;
}) {
  const home = useContext(HomeContext);
  const [initialRead, setInitialRead] = useState(true);
  if (initialRead && home?.loaded) setInitialRead(false);
  if (!home?.snapshot.owner) return null;
  const entries = home.snapshot.entries;
  if (!entries && !home.loaded && initialRead)
    return <HomeCollectionsLoading />;
  if (!entries)
    return (
      <div className="flex flex-wrap gap-2">
        {[
          ["/library", "All saved games"],
          ["/library?status=backlog", "Backlog"],
          ["/wishlist", "Wishlist"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11",
            })}
          >
            {label} (…)
          </Link>
        ))}
        <p className="flex items-center gap-2">
          {!home.loaded && <Spinner />}
          <span className={cn(!home.loaded && "shimmer")}>
            {home.loaded
              ? "Journal status unavailable."
              : "Checking Journal status…"}
          </span>
        </p>
        <Button onClick={home.retry} disabled={!home.loaded}>
          Retry Journal
        </Button>
      </div>
    );
  return (
    <HomeJournal
      entries={entries}
      steamImportEnabled={steamImportEnabled}
      wishlistPreview={
        <HomeWishlistPreview
          renderControls={(game) => <HomeSaveControls game={game} />}
          entries={entries
            .flatMap((entry) =>
              entry.status === "wishlist" && entry.release
                ? [
                    {
                      gameId: entry.gameId,
                      title: entry.title,
                      slug: entry.slug,
                      coverImageId: entry.coverImageId,
                      release: entry.release,
                    },
                  ]
                : [],
            )
            .sort(compareWishlist)}
        />
      }
    />
  );
}

/** Entries arrive in the Journal's canonical addition order, without private notes. */
export function HomeJournal({
  entries,
  wishlistPreview,
  steamImportEnabled = false,
}: {
  entries: HomeEntry[];
  wishlistPreview?: ReactNode;
  steamImportEnabled?: boolean;
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
                className:
                  "min-h-11 h-auto whitespace-normal py-2 tabular-nums",
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
        <div className="flex flex-col items-start gap-4">
          <p className="text-muted-foreground">
            Your Journal is empty. Search above and add a game to Backlog or
            Wishlist.
            <FeedbackLink />
          </p>
          {steamImportEnabled && <SteamImportInvitation />}
        </div>
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
  games: HomeEntry[];
  href: string;
}) {
  const id = useId();
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
            : "grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4"
        }
      >
        {games.map((entry) => (
          <li
            key={entry.gameId}
            className={
              compact ? "min-w-0" : "row-span-3 grid min-w-0 grid-rows-subgrid"
            }
          >
            <HomeCoverLink
              gameId={entry.gameId}
              source="shelf"
              href={`/games/${entry.slug}`}
              prefetch={true}
              className={`home-details group gap-3 rounded-lg outline-none ${compact ? "flex items-center" : "row-span-2 grid grid-rows-subgrid"}`}
              cover={
                <GameCover
                  imageId={entry.coverImageId}
                  size={compact ? "cover_small" : undefined}
                  className={
                    compact ? "w-12 rounded-sm" : "w-full rounded-lg shadow-lg"
                  }
                />
              }
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="break-words font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
                  {entry.title}
                </span>
              </div>
            </HomeCoverLink>
            <HomeSaveControls game={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
