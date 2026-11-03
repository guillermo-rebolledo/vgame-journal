"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { changeOwnerList, readOwnerLists } from "@/app/lists/actions";
import { ListSessionBoundary, useListSession } from "@/components/list-session";
import { CreateListForm } from "@/components/owner-lists";
import { PagedList, useUrlPagination } from "@/components/paged-list";
import { Button } from "@/components/ui/button";
import { authPageHref } from "@/lib/auth-continuation";
import type { OwnerList } from "@/lib/lists";

type Game = { id: number; slug: string; title: string };

export function GameListPicker({
  actor,
  game,
  needsUsername,
}: {
  actor: string | null;
  game: Game;
  needsUsername: boolean;
}) {
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("addToList") === "1");
  const trigger = useRef<HTMLButtonElement>(null);
  const section = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) section.current?.focus();
  }, [open]);
  function toggle() {
    const next = !open;
    setOpen(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("addToList", "1");
    else url.searchParams.delete("addToList");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    if (!next) trigger.current?.focus();
  }
  return (
    <div className="flex flex-col gap-3">
      <Button
        ref={trigger}
        variant="outline"
        className="min-h-11 self-start"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
      >
        {open ? "Close list picker" : "Add to list"}
      </Button>
      {open && (
        <section
          id={id}
          ref={section}
          tabIndex={-1}
          aria-label={`Add ${game.title} to a list`}
          className="flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <h2 className="break-words font-semibold text-xl">
            Add {game.title} to a list
          </h2>
          {actor ? (
            <ListSessionBoundary key={actor} actor={actor}>
              <Choices actor={actor} game={game} />
            </ListSessionBoundary>
          ) : (
            <Link
              className="underline"
              href={authPageHref(
                needsUsername ? "/onboarding" : "/sign-in",
                `/games/${game.slug}?addToList=1`,
              )}
            >
              {needsUsername
                ? `Choose a username to add ${game.title} to a list`
                : `Sign in to add ${game.title} to a list`}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

function Choices({ actor, game }: { actor: string; game: Game }) {
  const access = useListSession();
  const [items, setItems] = useState<OwnerList[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, start] = useTransition();
  const [blocked, setBlocked] = useState(false);
  const pagination = useUrlPagination("pickerPage", items?.length);
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let cancelled = false;
    setMessage(attempt ? "Checking your saved lists…" : "");
    start(async () => {
      try {
        const result = await readOwnerLists(actor);
        if (cancelled) return;
        if (!result.ok) {
          if (result.code === "authentication") access.deny();
          else setError("Lists are unavailable. Try again.");
          return;
        }
        if (!(await access.confirm()) || cancelled) return;
        setMessage("");
        setItems(result.value);
        setError("");
        setBlocked(false);
      } catch {
        if (!cancelled) setError("Lists are unavailable. Try again.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [actor, access, attempt]);
  function add(list: OwnerList) {
    if (pending || blocked) return;
    start(async () => {
      try {
        const result = await changeOwnerList(actor, list.id, list.revision, {
          kind: "add",
          gameId: game.id,
        });
        if (!result.ok) {
          if (result.code === "authentication") {
            access.deny();
            return;
          }
          setError(result.message);
          setBlocked(true);
          return;
        }
        if (!(await access.confirm())) return;
        const saved = result.value;
        if (!saved) {
          setError("List not found. Refresh your lists.");
          setBlocked(true);
          return;
        }
        setItems(
          (current) =>
            current?.map((item) => (item.id === saved.id ? saved : item)) ??
            null,
        );
        setMessage(`${game.title} added to ${saved.title}.`);
        setError("");
      } catch {
        setError(
          "Couldn’t confirm the addition. Refresh your lists before retrying.",
        );
        setBlocked(true);
      }
    });
  }
  return (
    <>
      <p
        ref={heading}
        tabIndex={-1}
        className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Adding a game changes only the selected list.
      </p>
      {items === null && !error && <output>Loading your lists…</output>}
      {error && <p role="alert">{error}</p>}
      <Button
        variant="outline"
        disabled={pending}
        className="min-h-11 self-start"
        onClick={() => setAttempt((value) => value + 1)}
      >
        Refresh lists
      </Button>
      <output aria-live="polite">{message}</output>
      {items !== null && (
        <>
          {items.length === 0 ? (
            <p>No lists yet. Create a list for {game.title} below.</p>
          ) : (
            <PagedList
              items={items}
              label="Choose a list"
              pagination={pagination}
            >
              {(lists) => (
                <ul className="flex flex-col gap-2">
                  {lists.map((list) => {
                    const added = list.games.some(
                      (entry) => entry.gameId === game.id,
                    );
                    return (
                      <li
                        key={list.id}
                        className="flex min-w-0 flex-col gap-2 rounded-lg border p-3"
                      >
                        <p className="break-words font-medium">{list.title}</p>
                        <p className="text-muted-foreground text-sm">
                          {list.visibility === "private" ? "Private" : "Public"}{" "}
                          · {list.gameCount}{" "}
                          {list.gameCount === 1 ? "game" : "games"}
                        </p>
                        <Button
                          variant="outline"
                          className="min-h-11 self-start"
                          aria-label={
                            added
                              ? `${game.title} already in ${list.title}`
                              : `Add ${game.title} to ${list.title}`
                          }
                          disabled={pending || blocked || added}
                          onClick={() => add(list)}
                        >
                          {added ? "Already in list" : "Add here"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PagedList>
          )}
          <details open={items.length === 0}>
            <summary className="min-h-11 cursor-pointer py-3 underline">
              Create a new list for {game.title}
            </summary>
            <CreateListForm
              actor={actor}
              scope={`picker:${game.id}`}
              disabled={pending || blocked}
              onCreated={(list) => {
                setItems((current) => [
                  list,
                  ...(current ?? []).filter((item) => item.id !== list.id),
                ]);
                pagination.onPageChange(1);
                setMessage(
                  `List created. Choose Add here to add ${game.title}.`,
                );
                heading.current?.focus();
              }}
            />
          </details>
        </>
      )}
    </>
  );
}
