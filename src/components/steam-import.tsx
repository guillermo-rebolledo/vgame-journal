"use client";

import { cn } from "cn";
import { Check, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { countBucket, trackEvent } from "@/components/analytics";
import {
  FirstSaveFeedback,
  useFeedbackChannel,
} from "@/components/feedback-channel";
import { PagedList } from "@/components/paged-list";
import { SteamAttribution } from "@/components/steam-connection";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { SteamReview, SteamReviewRow } from "@/lib/steam-import";

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
const countLabels: Record<SteamReviewRow["state"], string> = {
  ...rowLabels,
  needs_look: "Needs a look",
};
const games = (count: number) => `${count} ${count === 1 ? "game" : "games"}`;

type StepState = "waiting" | "active" | "working" | "done" | "error";

function ImportSteps({
  steps,
}: {
  steps: { label: string; detail: string; state: StepState }[];
}) {
  return (
    <ol
      aria-label="Steam import progress"
      className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3"
    >
      {steps.map(({ label, detail, state }, index) => (
        <li
          key={label}
          aria-current={
            state === "active" || state === "working" || state === "error"
              ? "step"
              : undefined
          }
          className="flex min-w-0 items-start gap-2"
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums [&_svg]:size-3.5",
              state === "done" && "bg-muted",
              (state === "active" || state === "working") &&
                "border-foreground",
              state === "error" && "border-destructive text-destructive",
              state === "waiting" && "text-muted-foreground",
            )}
          >
            {state === "done" ? (
              <Check />
            ) : state === "working" ? (
              <Spinner />
            ) : state === "error" ? (
              <CircleAlert />
            ) : (
              index + 1
            )}
          </span>
          <span className="min-w-0 text-sm">
            <span
              className={cn(
                "block",
                state === "waiting"
                  ? "text-muted-foreground"
                  : state !== "done" && "font-medium",
              )}
            >
              {label}
            </span>
            <span className="block text-muted-foreground tabular-nums">
              {detail}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SteamImport({
  publicProfile,
  onRead,
  onCommit,
}: {
  publicProfile: boolean;
  onRead: () => Promise<SteamReview>;
  onCommit: (
    appids: number[],
  ) => Promise<
    { added: number; feedbackInvitation: boolean } | { error: string }
  >;
}) {
  const [review, setReview] = useState<SteamReview>();
  const [selected, setSelected] = useState(new Set<number>());
  const [sort, setSort] = useState<"playtime" | "lastPlayed">("playtime");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; requested: number }>();
  const feedback = useFeedbackChannel();
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState<"read" | "commit">("read");
  const busy = useRef(false);
  const sortId = useId();
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  function run(next: "read" | "commit", work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setOperation(next);
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
  const reviewing = review?.kind === "review";
  const reading = pending && operation === "read";
  const committing = pending && operation === "commit";
  const skipped = result ? result.requested - result.added : 0;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Choose games from your Steam account to add as Backlog. Existing Journal
        entries and previously removed games stay untouched. No Playthroughs are
        created.
      </p>
      <ImportSteps
        steps={[
          {
            label: "Read Steam",
            state: reading
              ? "working"
              : reviewing
                ? "done"
                : review
                  ? "error"
                  : "active",
            detail: reading
              ? "In progress"
              : reviewing
                ? `${games(rows.length)} found`
                : review
                  ? "Needs attention"
                  : "Ready to start",
          },
          {
            label: "Review matches",
            state:
              result || committing ? "done" : reviewing ? "active" : "waiting",
            detail: reviewing
              ? `${selected.size} of ${ready.length} selected`
              : "Waiting",
          },
          {
            label: "Add to Backlog",
            state: result ? "done" : committing ? "working" : "waiting",
            detail: result
              ? `${result.added} added`
              : committing
                ? `Adding ${selected.size}`
                : "Waiting",
          },
        ]}
      />
      {result ? (
        <div className="enter flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
          <h2
            ref={resultHeading}
            tabIndex={-1}
            className="font-medium tabular-nums outline-none"
          >
            {games(result.added)} added to Backlog
          </h2>
          {skipped > 0 && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {games(skipped)} not added. Games already in your Journal and
              previously removed games stay untouched.
            </p>
          )}
          <Link
            href="/library?status=backlog"
            className={buttonVariants({ className: "min-h-11 self-start" })}
          >
            View Backlog
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={reviewing ? "outline" : "default"}
            className="min-h-11"
            disabled={pending}
            onClick={() =>
              run("read", async () => {
                const next = await onRead();
                trackEvent("steam_import_read", {
                  outcome: next.kind,
                  games: countBucket(
                    next.kind === "review" ? next.rows.length : 0,
                  ),
                });
                if (next.kind !== "review" && review?.kind === "review") {
                  setError(messages[next.kind]);
                  return;
                }
                setReview(next);
                setSelected(
                  new Set(
                    next.kind === "review"
                      ? next.rows
                          .filter((r) => r.state === "ready")
                          .map((r) => r.appid)
                      : [],
                  ),
                );
              })
            }
          >
            {reviewing
              ? "Read Steam again"
              : review
                ? "Retry Steam import"
                : "Start Steam import"}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <output aria-live="polite" aria-atomic="true">
          {reading ? (
            <ActionFeedback state="pending">
              Reading and matching Steam games…
            </ActionFeedback>
          ) : committing ? (
            <ActionFeedback state="pending">
              Adding selected games to Backlog…
            </ActionFeedback>
          ) : error ? (
            <ActionFeedback state="error">{error}</ActionFeedback>
          ) : review && review.kind !== "review" ? (
            messages[review.kind]
          ) : (
            ""
          )}
        </output>
        {pending && (
          <p className="text-sm text-muted-foreground">
            Large Steam accounts can take up to three minutes. Keep this page
            open.
          </p>
        )}
      </div>
      {reviewing && !result && (
        <div
          className="flex min-w-0 flex-col gap-4 [&_:is(a,button,[role=checkbox])]:scroll-mb-28"
          aria-busy={pending}
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
            {(Object.keys(rowLabels) as SteamReviewRow["state"][]).map(
              (state) => {
                const count = rows.filter((r) => r.state === state).length;
                return count ? (
                  <li key={state}>
                    {count}{" "}
                    <span className="text-muted-foreground">
                      {countLabels[state]}
                    </span>
                  </li>
                ) : null;
              },
            )}
          </ul>
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
          {!ready.length && <p>No new games are ready to import.</p>}
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
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t bg-background py-3">
            <p className="text-sm tabular-nums">
              {selected.size} of {ready.length} selected
            </p>
            <Button
              className="min-h-11"
              disabled={pending || !selected.size}
              onClick={() =>
                run("commit", async () => {
                  const requested = selected.size;
                  const outcome = await onCommit([...selected]);
                  if ("error" in outcome) {
                    setError(outcome.error);
                    return;
                  }
                  trackEvent("steam_import_committed", {
                    added: countBucket(outcome.added),
                    selection: requested === ready.length ? "all" : "partial",
                  });
                  if (outcome.feedbackInvitation) feedback?.saved();
                  setResult({ added: outcome.added, requested });
                })
              }
            >
              Add {selected.size} to Backlog
            </Button>
          </div>
        </div>
      )}
      <FirstSaveFeedback />
      <SteamAttribution />
    </div>
  );
}
