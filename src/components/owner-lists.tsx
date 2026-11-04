"use client";

import { ArrowDown, ArrowUp, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  changeOwnerList,
  createOwnerList,
  editOwnerList,
  type ListChange,
  readOwnerList,
} from "@/app/lists/actions";
import { CopyButton } from "@/components/copy-button";
import { GameCover } from "@/components/game-cover";
import { GameSearch } from "@/components/game-search";
import {
  ListCreationDrawer,
  ListEditorDrawer,
} from "@/components/list-creation-drawer";
import { useListDraft } from "@/components/list-draft";
import { ListFields, ListVisibilityFields } from "@/components/list-form";
import { useListSession } from "@/components/list-session";
import { PagedList, useUrlPagination } from "@/components/paged-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SITE_URL } from "@/config/site";
import type { OwnerList } from "@/lib/lists";

export function CreateListForm({
  actor,
  onCreated,
  scope = "create",
  disabled = false,
  onCancel,
  onPendingChange,
  game,
}: {
  actor: string;
  onCreated?: (list: OwnerList) => void;
  scope?: string;
  disabled?: boolean;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
  game?: { id: number; title: string };
}) {
  const access = useListSession();
  const router = useRouter();
  const { draft, update, clear, ready } = useListDraft(actor, scope, {
    title: "",
    description: "",
    visibility: "private",
    submissionId: "",
  });
  const { title, description, visibility } = draft;
  const [error, setError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      aria-label="Create a list"
      noValidate
      className={
        onCancel
          ? "mx-auto flex w-full max-w-xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
          : "flex max-w-xl flex-col gap-4 text-sm"
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !ready || disabled) return;
        if (!title.trim()) {
          setTitleError("Enter a list title.");
          event.currentTarget
            .querySelector<HTMLInputElement>('[name="title"]')
            ?.focus();
          return;
        }
        setTitleError("");
        const submissionId = draft.submissionId || crypto.randomUUID();
        update({ submissionId });
        onPendingChange?.(true);
        start(async () => {
          try {
            const result = await createOwnerList(actor, {
              title,
              description,
              visibility,
              submissionId,
              gameId: game?.id,
            });
            if (!result.ok) {
              if (result.code === "authentication") {
                access.deny();
                return;
              }
              setError(result.message);
              return;
            }
            if (!(await access.confirm())) return;
            clear();
            setError("");
            if (onCreated) onCreated(result.value);
            else router.push(`/lists/${result.value.id}`);
          } catch {
            setError(
              "Couldn’t confirm creation. Your draft is kept. Try again; this won’t create a duplicate list.",
            );
          } finally {
            onPendingChange?.(false);
          }
        });
      }}
    >
      {!onCancel && !game && (
        <h2 className="font-semibold text-xl">Create a list</h2>
      )}
      <ListFields
        title={title}
        description={description}
        titleError={titleError}
        onTitle={(title) => {
          update({ title });
          setTitleError("");
        }}
        onDescription={(description) => update({ description })}
        disabled={pending || !ready || disabled}
      />
      <fieldset disabled={pending || !ready || disabled}>
        <ListVisibilityFields
          value={visibility}
          onChange={(visibility) => update({ visibility })}
        />
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {onCancel && (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={pending || !ready || disabled}
          className="min-h-11 self-start"
        >
          {pending
            ? "Creating…"
            : game
              ? `Create list and add ${game.title}`
              : "Create list"}
        </Button>
      </div>
    </form>
  );
}

export function OwnerLists({
  actor,
  items,
}: {
  actor: string;
  items: OwnerList[];
}) {
  const pagination = useUrlPagination("listsPage", items.length);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="sm:col-start-2 sm:row-start-1 sm:self-start">
        <ListCreationDrawer
          open={open}
          onOpenChange={setOpen}
          pending={creating}
        >
          <CreateListForm
            actor={actor}
            onCancel={() => setOpen(false)}
            onPendingChange={setCreating}
            onCreated={(list) => {
              setOpen(false);
              router.push(`/lists/${list.id}`);
            }}
          />
        </ListCreationDrawer>
      </div>
      <div className="min-w-0 sm:col-span-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm sm:p-8">
            <p className="font-medium">No lists yet</p>
            <p className="mt-2 text-muted-foreground">
              Create a list to keep games together for any occasion.
            </p>
          </div>
        ) : (
          <PagedList items={items} label="Your lists" pagination={pagination}>
            {(items) => (
              <ul className="grid gap-4 sm:grid-cols-2">
                {items.map((list) => (
                  <li
                    key={list.id}
                    className="group relative flex h-full min-w-0 flex-col gap-4 rounded-lg border p-4 hover:bg-muted/40"
                  >
                    <div
                      className="grid min-h-17 w-full max-w-56 grid-cols-4 gap-2"
                      aria-hidden="true"
                    >
                      {list.games.slice(0, 4).map((game) => (
                        <GameCover
                          key={game.gameId}
                          imageId={game.coverImageId}
                          size="cover_small"
                          className="w-full max-w-12 self-start rounded"
                        />
                      ))}
                      {list.games.length === 0 && (
                        <div className="col-span-4 flex min-h-17 items-center rounded bg-muted/40 px-3 text-muted-foreground text-xs">
                          No games added yet
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h2 className="break-words font-semibold text-base group-hover:underline group-hover:underline-offset-4">
                        <Link
                          href={`/lists/${list.id}`}
                          prefetch={false}
                          className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-foreground"
                        >
                          {list.title}
                        </Link>
                      </h2>
                      <p className="text-muted-foreground text-sm tabular-nums">
                        {list.visibility === "private" ? "Private" : "Public"} ·{" "}
                        {list.gameCount}{" "}
                        {list.gameCount === 1 ? "game" : "games"}
                        <span className="mx-1" aria-hidden="true">
                          ·
                        </span>
                        <span className="inline-block">
                          Updated{" "}
                          {new Date(list.updatedAt).toLocaleDateString("en-US")}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PagedList>
        )}
      </div>
    </>
  );
}

export function OwnerListEditor({
  actor,
  initial,
}: {
  actor: string;
  initial: OwnerList;
}) {
  const router = useRouter();
  const access = useListSession();
  const shareId = useId();
  const [list, setList] = useState(initial);
  const { draft, update, clear, ready } = useListDraft(actor, initial.id, {
    title: initial.title,
    description: initial.description,
    visibility: initial.visibility,
    submissionId: "",
    revision: initial.revision,
  });
  const { title, description } = draft;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [pending, start] = useTransition();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [gone, setGone] = useState(false);
  const [panel, setPanel] = useState<"games" | "details" | "sharing" | null>(
    null,
  );
  const searchInput = useRef<HTMLInputElement>(null);
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (
      ready &&
      draft.revision !== undefined &&
      draft.revision !== list.revision
    ) {
      setNeedsRefresh(true);
      setError(
        "This list changed or a previous save was not confirmed. Your draft is kept. Refresh the saved list before retrying.",
      );
    }
  }, [ready, draft.revision, list.revision]);
  const pagination = useUrlPagination("gamesPage", list.games.length);
  const [focusGame, setFocusGame] = useState<number | null>(null);
  const emptyFocus = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusGame === null || pending) return;
    if (focusGame === 0) emptyFocus.current?.focus();
    else document.getElementById(`list-game-${shareId}-${focusGame}`)?.focus();
    setFocusGame(null);
  }, [focusGame, pending, shareId]);
  function change(change: ListChange, focus?: number, position?: number) {
    if (pending || needsRefresh || !ready) return;
    start(async () => {
      try {
        const result = await changeOwnerList(
          actor,
          list.id,
          list.revision,
          change,
        );
        if (!result.ok) {
          if (result.code === "authentication") {
            access.deny();
            return;
          }
          setError(result.message);
          setNeedsRefresh(result.code !== "validation");
          return;
        }
        if (!(await access.confirm())) return;
        if (!result.value) {
          clear();
          router.push("/lists");
          return;
        }
        update({ revision: result.value.revision });
        setList(result.value);
        setError("");
        setMessage(
          change.kind === "visibility"
            ? "Visibility saved."
            : "List games saved.",
        );
        if (focus !== undefined) {
          pagination.onPageChange(
            Math.floor(
              Math.min(
                position ?? 0,
                Math.max(0, result.value.games.length - 1),
              ) / 48,
            ) + 1,
          );
          setFocusGame(focus);
        }
      } catch {
        setError(
          "Couldn’t confirm the save. Your input is kept. Refresh the saved list before retrying.",
        );
        setNeedsRefresh(true);
      }
    });
  }
  function move(index: number, direction: number) {
    const games = list.games.map((game) => game.gameId);
    [games[index], games[index + direction]] = [
      games[index + direction],
      games[index],
    ];
    change(
      { kind: "reorder", gameIds: games },
      games[index + direction],
      index + direction,
    );
  }
  if (gone)
    return (
      <div role="alert">
        List not found.{" "}
        <Link href="/lists" className="underline">
          Return to your lists
        </Link>
      </div>
    );
  function reloadSaved() {
    if (pending) return;
    start(async () => {
      try {
        const result = await readOwnerList(actor, list.id);
        if (!result.ok) {
          if (result.code === "authentication") {
            access.deny();
            return;
          }
          setError(result.message);
          return;
        }
        if (!(await access.confirm())) return;
        if (!result.value) {
          setGone(true);
          return;
        }
        update({ revision: result.value.revision });
        setList(result.value);
        setNeedsRefresh(false);
        setError("");
        setMessage(
          "Saved list refreshed. Your draft is kept; review it before saving again.",
        );
      } catch {
        setError(
          "Lists are unavailable. Your draft is kept. Try refreshing again.",
        );
      }
    });
  }
  const feedback = (
    <>
      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 text-sm">
          <p>{error}</p>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={reloadSaved}
          >
            Refresh saved list
          </Button>
        </div>
      )}
      <output aria-live="polite" className="text-sm empty:hidden">
        {message}
      </output>
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="break-words text-balance font-semibold text-3xl tracking-tight">
            {list.title}
          </h1>
          <p className="text-muted-foreground text-sm tabular-nums">
            {list.visibility === "private" ? "Private" : "Public"} ·{" "}
            <span>
              {list.gameCount} {list.gameCount === 1 ? "game" : "games"}
            </span>{" "}
            · Updated {new Date(list.updatedAt).toLocaleDateString("en-US")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ListEditorDrawer
            title="Add games"
            description="Search the Catalog and add games to this list. Your Journal stays unchanged."
            open={panel === "games"}
            onOpenChange={(open) => setPanel(open ? "games" : null)}
            pending={pending}
            initialFocus={searchInput}
            trigger={
              <Button className="min-h-11" disabled={!ready}>
                <Plus aria-hidden="true" />
                Add games
              </Button>
            }
          >
            <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
              {panel === "games" && feedback}
              <section className="max-w-2xl">
                <GameSearch
                  inputRef={searchInput}
                  guidance="Adding games here changes only this list."
                  renderAction={(game) => {
                    const added = list.games.some(
                      (item) => item.gameId === game.id,
                    );
                    return (
                      <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={pending || !ready || needsRefresh || added}
                        aria-label={
                          added
                            ? `${game.title} already in list`
                            : `Add ${game.title} to list`
                        }
                        onClick={() => change({ kind: "add", gameId: game.id })}
                      >
                        {added ? "Already in list" : "Add to list"}
                      </Button>
                    );
                  }}
                />
              </section>
            </div>
          </ListEditorDrawer>
          <ListEditorDrawer
            title="Edit list"
            description="Update the title and description. Closing keeps your draft."
            open={panel === "details"}
            onOpenChange={(open) => setPanel(open ? "details" : null)}
            pending={pending}
            trigger={
              <Button variant="outline" className="min-h-11">
                Edit details
              </Button>
            }
          >
            <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
              <form
                aria-label="List details"
                noValidate
                className="flex max-w-2xl flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pending || needsRefresh || !ready) return;
                  if (!title.trim()) {
                    setTitleError("Enter a list title.");
                    event.currentTarget
                      .querySelector<HTMLInputElement>('[name="title"]')
                      ?.focus();
                    return;
                  }
                  setTitleError("");
                  start(async () => {
                    try {
                      const result = await editOwnerList(
                        actor,
                        list.id,
                        list.revision,
                        { title, description },
                      );
                      if (!result.ok) {
                        if (result.code === "authentication") {
                          access.deny();
                          return;
                        }
                        setError(result.message);
                        setNeedsRefresh(result.code !== "validation");
                        return;
                      }
                      if (!(await access.confirm())) return;
                      update({
                        title: result.value.title,
                        description: result.value.description,
                        revision: result.value.revision,
                      });
                      setList(result.value);
                      setError("");
                      setMessage("Details saved.");
                      setPanel(null);
                    } catch {
                      setError(
                        "Couldn’t confirm the save. Your input is kept. Refresh the saved list before retrying.",
                      );
                      setNeedsRefresh(true);
                    }
                  });
                }}
              >
                <ListFields
                  title={title}
                  description={description}
                  titleError={titleError}
                  onTitle={(title) => {
                    update({ title });
                    setTitleError("");
                  }}
                  onDescription={(description) => update({ description })}
                  disabled={pending || !ready || needsRefresh}
                />
                <Button
                  type="submit"
                  disabled={pending || !ready || needsRefresh}
                  className="min-h-11 self-start"
                >
                  {pending ? "Saving…" : "Save details"}
                </Button>
              </form>
              {panel === "details" && feedback}
            </div>
          </ListEditorDrawer>
          <DropdownMenu>
            <DropdownMenuTrigger
              ref={optionsTrigger}
              render={<Button variant="ghost" className="min-h-11" />}
            >
              List options
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPanel("sharing")}>
                Sharing
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={pending || !ready || needsRefresh}
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this list and all of its entries? This cannot be undone. Your Journal and other lists are kept.",
                    )
                  )
                    change({ kind: "delete" });
                }}
              >
                Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {list.description && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium">
            About this list
          </summary>
          <p className="max-w-prose whitespace-pre-wrap break-words">
            {list.description}
          </p>
        </details>
      )}
      {panel === null && feedback}
      <section className="flex flex-col gap-4">
        <h2
          ref={emptyFocus}
          tabIndex={-1}
          className="font-semibold text-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          List games
        </h2>
        {list.games.length === 0 ? (
          <p>No games yet. Choose Add games to start this list.</p>
        ) : (
          <PagedList
            items={list.games}
            label="List games"
            pagination={pagination}
          >
            {(games, offset) => (
              <ol
                aria-label="List games"
                start={offset + 1}
                className="flex flex-col gap-4"
              >
                {games.map((game, i) => {
                  const index = offset + i;
                  return (
                    <li
                      key={game.gameId}
                      className="flex min-w-0 gap-3 rounded-lg border p-3"
                    >
                      <GameCover
                        imageId={game.coverImageId}
                        size="cover_small"
                        className="w-12 self-start rounded"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Link
                          id={`list-game-${shareId}-${game.gameId}`}
                          href={`/games/${game.slug}`}
                          className="break-words font-medium underline underline-offset-4"
                        >
                          {game.title}
                        </Link>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="size-11"
                            aria-label={`Move ${game.title} up`}
                            disabled={
                              pending || !ready || needsRefresh || index === 0
                            }
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            variant="outline"
                            className="size-11"
                            aria-label={`Move ${game.title} down`}
                            disabled={
                              pending ||
                              !ready ||
                              needsRefresh ||
                              index === list.games.length - 1
                            }
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            variant="destructive"
                            className="min-h-11"
                            aria-label={`Remove ${game.title} from list`}
                            disabled={pending || !ready || needsRefresh}
                            onClick={() =>
                              change(
                                { kind: "remove", gameId: game.gameId },
                                list.games[index + 1]?.gameId ??
                                  list.games[index - 1]?.gameId ??
                                  0,
                                index,
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </PagedList>
        )}
      </section>
      <ListEditorDrawer
        title="Visibility and sharing"
        description="Choose who can read your list. Visibility changes save immediately."
        open={panel === "sharing"}
        onOpenChange={(open) => setPanel(open ? "sharing" : null)}
        pending={pending}
        finalFocus={optionsTrigger}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <section
            aria-label="List visibility"
            className="flex max-w-2xl flex-col gap-3"
          >
            <p>
              Private lists are visible only to you. Public lists can be read by
              anyone, including signed-out visitors, and appear on your public
              profile.
            </p>
            <Button
              variant="outline"
              disabled={pending || !ready || needsRefresh}
              className="min-h-11 self-start"
              onClick={() =>
                change({
                  kind: "visibility",
                  visibility:
                    list.visibility === "private" ? "public" : "private",
                })
              }
            >
              {list.visibility === "private" ? "Publish list" : "Make private"}
            </Button>
            {list.visibility === "public" && list.creator.username && (
              <>
                <label htmlFor={shareId}>Public list URL</label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id={shareId}
                    readOnly
                    className="min-h-11 flex-1"
                    value={`${SITE_URL}/u/${list.creator.username}/lists/${list.id}`}
                  />
                  <CopyButton
                    key={list.id}
                    text={`${SITE_URL}/u/${list.creator.username}/lists/${list.id}`}
                    inputId={shareId}
                    target="list"
                  />
                </div>
                <Link
                  href={`/u/${list.creator.username}/lists/${list.id}`}
                  prefetch={false}
                  className="underline"
                >
                  View public list
                </Link>
              </>
            )}
          </section>
          {panel === "sharing" && feedback}
        </div>
      </ListEditorDrawer>
    </div>
  );
}
