"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import {
  FirstSaveFeedback,
  useFeedbackChannel,
} from "@/components/feedback-channel";
import { PagedList } from "@/components/paged-list";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { SteamReview } from "@/lib/steam-import";

const messages = {
  hidden:
    "Steam Game details could not be read. On Steam, open Edit profile → Privacy settings and set Game details to Public. You can set it back after the import. Retry in one minute.",
  empty: "Your Steam account has no games to import.",
  too_many:
    "Steam import supports up to 10,000 games at once. Your account exceeds this limit.",
  unavailable:
    "Steam or the Catalog is unavailable. Your Journal is unchanged. Retry in one minute.",
  cooldown:
    "Please wait before reading Steam again: one minute after a read, or five minutes after an import.",
  disconnected: "Steam is disconnected. Connect again to start a Steam import.",
};
const rowLabels = {
  ready: "Ready",
  needs_look: "Needs a look: find the base game in the Catalog",
  existing: "Already in Journal",
  removed: "Previously removed",
  unmatched: "No exact Catalog match",
};
export function SteamImport({
  connected,
  enabled,
  publicProfile,
  connectionResult,
  onRead,
  onCommit,
  onDisconnect,
}: {
  connected: boolean;
  enabled: boolean;
  publicProfile: boolean;
  connectionResult?: string;
  onRead: () => Promise<SteamReview>;
  onCommit: (
    appids: number[],
  ) => Promise<
    { added: number; feedbackInvitation: boolean } | { error: string }
  >;
  onDisconnect: () => Promise<{ disconnected: true } | { error: string }>;
}) {
  const [linked, setLinked] = useState(connected);
  const [review, setReview] = useState<SteamReview>();
  const [selected, setSelected] = useState(new Set<number>());
  const [sort, setSort] = useState<"playtime" | "lastPlayed">("playtime");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    connectionResult === "failed"
      ? "Steam sign-in failed or was cancelled. Nothing was connected. Try again."
      : connectionResult === "connected"
        ? "Steam connected."
        : "",
  );
  const feedback = useFeedbackChannel();
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState("");
  const busy = useRef(false);
  const sortId = useId();
  function run(label: string, work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setNotice("");
    setOperation(label);
    startTransition(async () => {
      try {
        await work();
      } catch {
        setError(
          "Could not confirm the Steam import. Your selection is kept. Try again in one minute; entries already saved will be skipped.",
        );
      } finally {
        busy.current = false;
      }
    });
  }
  const rows =
    review?.kind === "review"
      ? review.rows.toSorted(
          (a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name),
        )
      : [];
  const ready = rows.filter((r) => r.state === "ready");
  return (
    <section
      aria-labelledby="steam-heading"
      className="flex min-w-0 flex-col gap-4 border-t pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="steam-heading" className="font-medium">
          Steam import
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose games from your Steam account to add as Backlog. Existing
          Journal entries and previously removed games stay untouched. No
          Playthroughs are created.
        </p>
      </div>
      <p className="text-sm">
        {linked ? "Steam connected" : "Steam not connected"}
      </p>
      {!enabled && (
        <p className="text-sm text-muted-foreground">
          Steam import is not available yet. You can keep adding games through
          Catalog search.
        </p>
      )}
      {!linked && enabled && (
        <a
          href="/api/steam/connect"
          className="inline-flex min-h-11 self-start items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Image
            src="/steam/sign-in.png"
            width={180}
            height={35}
            alt="Sign in through Steam"
          />
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        {linked && enabled && (
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={() =>
              run("Reading and matching Steam games…", async () => {
                const result = await onRead();
                setReview(result);
                setSelected(
                  new Set(
                    result.kind === "review"
                      ? result.rows
                          .filter((r) => r.state === "ready")
                          .map((r) => r.appid)
                      : [],
                  ),
                );
              })
            }
          >
            {review ? "Retry Steam import" : "Start Steam import"}
          </Button>
        )}
        {linked && (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() =>
              run("Disconnecting Steam…", async () => {
                const result = await onDisconnect();
                if ("error" in result) {
                  setError(result.error);
                  return;
                }
                setLinked(false);
                setReview(undefined);
                setSelected(new Set());
                setNotice("Steam disconnected. Your Journal is unchanged.");
              })
            }
          >
            Disconnect Steam
          </Button>
        )}
      </div>
      <output aria-live="polite" aria-atomic="true">
        {pending ? (
          <ActionFeedback state="pending">{operation}</ActionFeedback>
        ) : error ? (
          <ActionFeedback state="error">{error}</ActionFeedback>
        ) : (
          notice ||
          (review && review.kind !== "review" ? messages[review.kind] : "")
        )}
      </output>
      {review?.kind === "review" && (
        <div className="flex min-w-0 flex-col gap-4" aria-busy={pending}>
          <p className="text-sm tabular-nums">
            {ready.length} games ready · {selected.size} selected
          </p>
          {publicProfile && (
            <p className="rounded-lg border bg-muted/40 p-4 text-sm">
              Your profile is Public. Imported games will appear on your Public
              profile. You can change Profile visibility in Settings.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Playtime and last played only sort this review; neither is saved.
            Editions of the same game appear once.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending || !ready.length}
              onClick={() => setSelected(new Set(ready.map((r) => r.appid)))}
            >
              Select all
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending || !selected.size}
              onClick={() => setSelected(new Set())}
            >
              Deselect all
            </Button>
            <label htmlFor={sortId} className="text-sm">
              Sort by
            </label>
            <Select
              value={sort}
              onValueChange={(value) => {
                if (value) setSort(value);
              }}
            >
              <SelectTrigger id={sortId} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="playtime">Playtime</SelectItem>
                  <SelectItem value="lastPlayed">Last played</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {!rows.length && <p>No new games are ready to import.</p>}
          <PagedList items={rows} label="Steam games">
            {(page) => (
              <ul className="divide-y">
                {page.map((row) => (
                  <li
                    key={row.appid}
                    className="flex min-w-0 flex-col gap-1 py-2"
                  >
                    <label
                      htmlFor={`${sortId}-${row.appid}`}
                      className="flex min-h-11 min-w-0 items-center gap-3 text-sm"
                    >
                      <Checkbox
                        id={`${sortId}-${row.appid}`}
                        checked={selected.has(row.appid)}
                        disabled={pending || row.state !== "ready"}
                        onCheckedChange={(checked) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (checked) next.add(row.appid);
                            else next.delete(row.appid);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 break-words">
                        {row.name}
                        <span className="block text-muted-foreground">
                          {rowLabels[row.state]}
                        </span>
                      </span>
                    </label>
                    {(row.state === "unmatched" ||
                      row.state === "needs_look") && (
                      <Link
                        href={`/?q=${encodeURIComponent(row.name)}`}
                        className="inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4"
                      >
                        Find in Catalog
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PagedList>
          <Button
            className="min-h-11 self-start"
            disabled={pending || !selected.size}
            onClick={() =>
              run("Adding selected games to Backlog…", async () => {
                const result = await onCommit([...selected]);
                if ("error" in result) {
                  setError(result.error);
                  return;
                }
                toast.add({
                  title: `${result.added} ${result.added === 1 ? "game" : "games"} added to Backlog`,
                  type: "success",
                });
                if (result.feedbackInvitation) feedback?.saved();
                setReview(undefined);
                setSelected(new Set());
              })
            }
          >
            Add {selected.size} to Backlog
          </Button>
        </div>
      )}
      <FirstSaveFeedback />
      <p className="text-xs text-muted-foreground">
        Steam data is provided “as is”, without warranties of accuracy,
        availability or fitness for a particular purpose. To the extent
        permitted by law, Valve and shelve.games are not liable for damages
        arising from its use. shelve.games is not endorsed by or affiliated with
        Valve.{" "}
        <a
          href="https://store.steampowered.com/"
          className="underline underline-offset-4"
        >
          Steam
        </a>{" "}
        ·{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy notice
        </Link>
      </p>
    </section>
  );
}
