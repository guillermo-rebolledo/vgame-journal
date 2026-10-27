import { refresh } from "next/cache";
import {
  PlaythroughForm,
  type SavePlaythrough,
} from "@/components/playthrough-form";
import { PlaythroughHistory } from "@/components/playthrough-history";
import { ownerId, signedInUserId } from "@/lib/auth";
import { JournalError, journal, type PlaythroughInput } from "@/lib/journal";

type FormValues = Record<string, string>;

const fromForm = (values: FormValues): PlaythroughInput => ({
  platform: values.platform ?? "",
  startedOn: values.startedOn ?? "",
  endedOn: values.endedOn || null,
  hours: values.hours ? Number(values.hours) : null,
  notes: values.notes ?? "",
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

  async function update(id: number, values: FormValues) {
    "use server";
    const owner = await ownerId();
    return saveOrReturnError(() =>
      journal.updatePlaythrough(owner, id, fromForm(values)),
    );
  }

  async function remove(id: number) {
    "use server";
    const owner = await ownerId();
    await journal.removePlaythrough(owner, id);
    refresh();
  }

  return (
    <section className="enter flex flex-col gap-3 rounded-lg border bg-background/60 p-4 backdrop-blur sm:max-w-md">
      <h2 className="font-medium">Playthroughs</h2>
      {playthroughs.length > 0 && (
        <PlaythroughHistory
          playthroughs={playthroughs}
          platforms={platforms}
          onUpdate={update}
          onRemove={remove}
        />
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
