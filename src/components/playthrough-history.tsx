"use client";

import { useState } from "react";
import { PagedList } from "@/components/paged-list";
import {
  PlaythroughForm,
  type SavePlaythrough,
} from "@/components/playthrough-form";
import { Button } from "@/components/ui/button";
import type { playthrough as playthroughTable } from "@/db/schema";

type Playthrough = typeof playthroughTable.$inferSelect;
type Update = (
  id: number,
  values: Record<string, string>,
) => ReturnType<SavePlaythrough>;

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

export function PlaythroughHistory({
  playthroughs,
  platforms,
  onUpdate,
  onRemove,
}: {
  playthroughs: Playthrough[];
  platforms: string[];
  onUpdate: Update;
  onRemove: (id: number) => Promise<void>;
}) {
  return (
    <PagedList items={playthroughs} label="Playthrough history">
      {(visible, offset) => (
        <ol
          start={offset + 1}
          className="flex flex-col divide-y divide-border/60"
        >
          {visible.map((playthrough) => (
            <HistoryRow
              key={playthrough.id}
              playthrough={playthrough}
              platforms={platforms}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ol>
      )}
    </PagedList>
  );
}

function HistoryRow({
  playthrough,
  platforms,
  onUpdate,
  onRemove,
}: {
  playthrough: Playthrough;
  platforms: string[];
  onUpdate: Update;
  onRemove: (id: number) => Promise<void>;
}) {
  // Mount on first open, then keep drafts when the editor is collapsed.
  const [editorOpened, setEditorOpened] = useState(false);
  return (
    <li className="flex flex-col gap-1 py-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span>{playthrough.platform}</span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {day(playthrough.startedOn)} –{" "}
          {playthrough.endedOn ? day(playthrough.endedOn) : "ongoing"}
          {playthrough.hours !== null && ` · ${playthrough.hours} h`}
        </span>
      </p>
      {playthrough.notes && (
        <p className="whitespace-pre-line text-pretty text-sm">
          {playthrough.notes}
        </p>
      )}
      <details
        className="text-sm"
        onToggle={(event) => {
          if (event.currentTarget.open) setEditorOpened(true);
        }}
      >
        <summary className="cursor-pointer text-muted-foreground">Edit</summary>
        {editorOpened && (
          <div className="flex flex-col gap-3 pt-3">
            <PlaythroughForm
              platforms={platforms}
              initial={{
                platform: playthrough.platform,
                startedOn: playthrough.startedOn,
                endedOn: playthrough.endedOn ?? "",
                hours:
                  playthrough.hours === null ? "" : String(playthrough.hours),
                notes: playthrough.notes,
              }}
              submitLabel="Save"
              onSave={(values) => onUpdate(playthrough.id, values)}
            />
            <form action={() => onRemove(playthrough.id)}>
              <Button type="submit" variant="ghost" size="sm">
                Delete playthrough
              </Button>
            </form>
          </div>
        )}
      </details>
    </li>
  );
}
