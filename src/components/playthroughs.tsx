import { refresh } from "next/cache";
import { ownerId, signedInUserId } from "@/components/journal-status";
import {
  PlaythroughForm,
  type SavePlaythrough,
} from "@/components/playthrough-form";
import { Button } from "@/components/ui/button";
import { JournalError, journal, type PlaythroughInput } from "@/lib/journal";

const fromForm = (v: Record<string, string>): PlaythroughInput => ({
  platform: v.platform ?? "",
  startedOn: v.startedOn ?? "",
  endedOn: v.endedOn || null,
  hours: v.hours ? Number(v.hours) : null,
  notes: v.notes ?? "",
});

/** Runs a write and refreshes, or hands a broken Journal rule back to the form. */
async function attempt(write: () => Promise<void>) {
  try {
    await write();
  } catch (e) {
    if (e instanceof JournalError) return { error: e.message };
    throw e;
  }
  refresh();
}

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

/** The signed-in user's Playthroughs of a game in their journal, oldest first. */
export async function Playthroughs({
  gameId,
  platforms,
}: {
  gameId: number;
  platforms: string[];
}) {
  const userId = await signedInUserId();
  if (!userId || !(await journal.entry(userId, gameId))) return null;
  const runs = await journal.playthroughs(userId, gameId);

  const add: SavePlaythrough = async (values) => {
    "use server";
    const owner = await ownerId();
    return attempt(() =>
      journal.addPlaythrough(owner, gameId, fromForm(values)),
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4 backdrop-blur sm:max-w-md">
      <h2 className="font-medium">Playthroughs</h2>
      {runs.length > 0 && (
        <ol className="flex flex-col divide-y divide-border/60">
          {runs.map((run) => {
            const update: SavePlaythrough = async (values) => {
              "use server";
              const owner = await ownerId();
              return attempt(() =>
                journal.updatePlaythrough(owner, run.id, fromForm(values)),
              );
            };
            async function remove() {
              "use server";
              const owner = await ownerId();
              await journal.removePlaythrough(owner, run.id);
              refresh();
            }
            return (
              <li key={run.id} className="flex flex-col gap-1 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span>{run.platform}</span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {day(run.startedOn)} –{" "}
                    {run.endedOn ? day(run.endedOn) : "ongoing"}
                    {run.hours !== null && ` · ${run.hours} h`}
                  </span>
                </p>
                {run.notes && (
                  <p className="whitespace-pre-line text-pretty text-sm">
                    {run.notes}
                  </p>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Edit
                  </summary>
                  <div className="flex flex-col gap-3 pt-3">
                    <PlaythroughForm
                      platforms={platforms}
                      initial={{
                        platform: run.platform,
                        startedOn: run.startedOn,
                        endedOn: run.endedOn ?? "",
                        hours: run.hours === null ? "" : String(run.hours),
                        notes: run.notes,
                      }}
                      submitLabel="Save"
                      onSave={update}
                    />
                    <form action={remove}>
                      <Button type="submit" variant="ghost" size="sm">
                        Delete playthrough
                      </Button>
                    </form>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {platforms.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This game has no platforms listed yet, so playthroughs can't be
          logged.
        </p>
      ) : (
        <details open={runs.length === 0}>
          <summary className="cursor-pointer text-sm">
            Add a playthrough
          </summary>
          <div className="pt-3">
            <PlaythroughForm
              platforms={platforms}
              submitLabel="Add playthrough"
              onSave={add}
            />
          </div>
        </details>
      )}
    </section>
  );
}
