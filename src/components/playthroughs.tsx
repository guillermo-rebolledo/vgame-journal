import { refresh } from "next/cache";
import {
  PlaythroughForm,
  type SavePlaythrough,
} from "@/components/playthrough-form";
import { Button } from "@/components/ui/button";
import type { playthrough as playthroughTable } from "@/db/schema";
import { ownerId, signedInUserId } from "@/lib/auth";
import { JournalError, journal, type PlaythroughInput } from "@/lib/journal";

type Playthrough = typeof playthroughTable.$inferSelect;
type FormValues = Record<string, string>;

const fromForm = (values: FormValues): PlaythroughInput => ({
  platform: values.platform ?? "",
  startedOn: values.startedOn ?? "",
  endedOn: values.endedOn || null,
  hours: values.hours ? Number(values.hours) : null,
  notes: values.notes ?? "",
});

const toForm = (playthrough: Playthrough): FormValues => ({
  platform: playthrough.platform,
  startedOn: playthrough.startedOn,
  endedOn: playthrough.endedOn ?? "",
  hours: playthrough.hours === null ? "" : String(playthrough.hours),
  notes: playthrough.notes,
});

/** Runs a write and refreshes, or hands a broken Journal rule back to the form. */
async function saveOrReturnError(write: () => Promise<void>) {
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
  const playthroughs = await journal.playthroughs(userId, gameId);

  const add: SavePlaythrough = async (values) => {
    "use server";
    const owner = await ownerId();
    return saveOrReturnError(() =>
      journal.addPlaythrough(owner, gameId, fromForm(values)),
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4 backdrop-blur sm:max-w-md">
      <h2 className="font-medium">Playthroughs</h2>
      {playthroughs.length > 0 && (
        <ol className="flex flex-col divide-y divide-border/60">
          {playthroughs.map((playthrough) => {
            const update: SavePlaythrough = async (values) => {
              "use server";
              const owner = await ownerId();
              return saveOrReturnError(() =>
                journal.updatePlaythrough(
                  owner,
                  playthrough.id,
                  fromForm(values),
                ),
              );
            };
            async function remove() {
              "use server";
              const owner = await ownerId();
              await journal.removePlaythrough(owner, playthrough.id);
              refresh();
            }
            return (
              <li key={playthrough.id} className="flex flex-col gap-1 py-3">
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
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Edit
                  </summary>
                  <div className="flex flex-col gap-3 pt-3">
                    <PlaythroughForm
                      platforms={platforms}
                      initial={toForm(playthrough)}
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
        <details open={playthroughs.length === 0}>
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
