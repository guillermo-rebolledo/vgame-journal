"use client";

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
import { useListDraft } from "@/components/list-draft";
import { ListFields, ListVisibilityFields } from "@/components/list-form";
import { useListSession } from "@/components/list-session";
import { PagedList, useUrlPagination } from "@/components/paged-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_URL } from "@/config/site";
import type { OwnerList } from "@/lib/lists";

export function CreateListForm({
  actor,
  onCreated,
  scope = "create",
  disabled = false,
}: {
  actor: string;
  onCreated?: (list: OwnerList) => void;
  scope?: string;
  disabled?: boolean;
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
  const [pending, start] = useTransition();
  return (
    <form
      aria-label="Create a list"
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !ready || disabled) return;
        const submissionId = draft.submissionId || crypto.randomUUID();
        update({ submissionId });
        start(async () => {
          try {
            const result = await createOwnerList(actor, {
              title,
              description,
              visibility,
              submissionId,
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
              "Couldn’t confirm creation. Your input is kept. Retry uses the same submission and will not create a duplicate.",
            );
          }
        });
      }}
    >
      <h2 className="font-semibold text-xl">Create a list</h2>
      <ListFields
        title={title}
        description={description}
        onTitle={(title) => update({ title })}
        onDescription={(description) => update({ description })}
        disabled={pending || !ready || disabled}
      />
      <fieldset disabled={pending || disabled}>
        <ListVisibilityFields
          value={visibility}
          onChange={(visibility) => update({ visibility })}
        />
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <Button
        type="submit"
        disabled={pending || !ready || disabled}
        className="min-h-11 self-start"
      >
        {pending ? "Creating…" : "Create list"}
      </Button>
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
  return (
    <div className="flex flex-col gap-8">
      {items.length === 0 ? (
        <p>No lists yet. Create your first collection below.</p>
      ) : (
        <PagedList items={items} label="Your lists" pagination={pagination}>
          {(items) => (
            <ul className="grid gap-4 sm:grid-cols-2">
              {items.map((list) => (
                <li key={list.id} className="min-w-0 rounded-lg border p-4">
                  <Link
                    href={`/lists/${list.id}`}
                    prefetch={false}
                    className="break-words font-semibold underline underline-offset-4"
                  >
                    {list.title}
                  </Link>
                  <p>
                    {list.visibility === "private" ? "Private" : "Public"} ·{" "}
                    {list.gameCount} {list.gameCount === 1 ? "game" : "games"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Updated{" "}
                    {new Date(list.updatedAt).toLocaleDateString("en-US")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {list.games.slice(0, 4).map((game) => (
                      <GameCover
                        key={game.gameId}
                        imageId={game.coverImageId}
                        className="w-12 rounded"
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PagedList>
      )}
      <CreateListForm actor={actor} />
    </div>
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
  const [pending, start] = useTransition();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [gone, setGone] = useState(false);
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
  return (
    <div className="flex flex-col gap-6">
      <h1 className="break-words font-semibold text-3xl">{list.title}</h1>
      <p>
        {list.visibility === "private"
          ? "Private — only you can read this list."
          : "Public — anyone can read this list."}
      </p>
      <p>
        {list.gameCount} {list.gameCount === 1 ? "game" : "games"}
      </p>
      <p className="text-muted-foreground text-sm">
        Updated {new Date(list.updatedAt).toLocaleDateString("en-US")}
      </p>
      <form
        aria-label="List details"
        className="flex max-w-2xl flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || needsRefresh || !ready) return;
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
          onTitle={(title) => update({ title })}
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
      {error && <p role="alert">{error}</p>}
      <Button
        variant="outline"
        className="min-h-11 self-start"
        disabled={pending}
        onClick={reloadSaved}
      >
        Refresh saved list
      </Button>
      <output aria-live="polite">{message}</output>
      <section
        aria-label="List visibility"
        className="flex max-w-2xl flex-col gap-3"
      >
        <h2 className="font-semibold text-xl">Visibility and sharing</h2>
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
              visibility: list.visibility === "private" ? "public" : "private",
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
      <section className="flex flex-col gap-4">
        <h2
          ref={emptyFocus}
          tabIndex={-1}
          className="font-semibold text-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          List games
        </h2>
        {list.games.length === 0 ? (
          <p>No games yet. Search the Catalog below.</p>
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
                            className="min-h-11"
                            aria-label={`Move ${game.title} up`}
                            disabled={
                              pending || !ready || needsRefresh || index === 0
                            }
                            onClick={() => move(index, -1)}
                          >
                            Move up
                          </Button>
                          <Button
                            variant="outline"
                            className="min-h-11"
                            aria-label={`Move ${game.title} down`}
                            disabled={
                              pending || index === list.games.length - 1
                            }
                            onClick={() => move(index, 1)}
                          >
                            Move down
                          </Button>
                          <Button
                            variant="ghost"
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
      <Button
        variant="destructive"
        disabled={pending || !ready || needsRefresh}
        className="min-h-11 self-start"
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
      </Button>
      <section className="max-w-2xl">
        <GameSearch
          guidance="Adding games here changes only this list."
          renderAction={(game) => {
            const added = list.games.some((item) => item.gameId === game.id);
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
  );
}
