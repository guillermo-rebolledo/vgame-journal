"use client";

import { PagedList } from "@/components/paged-list";
import { PlatformName } from "@/components/platform";
import { Button } from "@/components/ui/button";
import type { playthrough as playthroughTable } from "@/db/schema";

type Playthrough = typeof playthroughTable.$inferSelect;
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

export function PlaythroughHistory({
  playthroughs,
  onEdit,
}: {
  playthroughs: Playthrough[];
  onEdit: (playthrough: Playthrough) => void;
}) {
  return (
    <PagedList items={playthroughs} label="Playthrough history">
      {(visible, offset) => (
        <ol
          start={offset + 1}
          className="flex flex-col divide-y divide-border/60"
        >
          {visible.map((playthrough) => (
            <li key={playthrough.id} className="flex flex-col gap-2 py-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                <PlatformName platform={playthrough.platform} />
                <span className="text-muted-foreground text-sm tabular-nums">
                  {day(playthrough.startedOn)} –{" "}
                  {playthrough.endedOn ? day(playthrough.endedOn) : "ongoing"}
                  {playthrough.hours !== null && ` · ${playthrough.hours} h`}
                </span>
              </p>
              {playthrough.notes && (
                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                  {playthrough.notes}
                </p>
              )}
              <Button
                variant="ghost"
                className="min-h-11 self-start"
                onClick={() => onEdit(playthrough)}
              >
                Edit
              </Button>
            </li>
          ))}
        </ol>
      )}
    </PagedList>
  );
}
