import { refresh } from "next/cache";
import { GameRecording } from "@/components/game-recording";
import { ownerId, signedInUserId } from "@/lib/auth";
import {
  type CompletionTag,
  JournalError,
  journal,
  type PlaythroughInput,
  type Status,
} from "@/lib/journal";

const fromForm = (values: Record<string, string>): PlaythroughInput => ({
  platform: values.platform ?? "",
  startedOn: values.startedOn ?? "",
  endedOn: values.endedOn || null,
  hours: values.hours ? Number(values.hours) : null,
  notes: values.notes ?? "",
});

async function saveOrReturnError(write: () => Promise<void>) {
  try {
    await write();
  } catch (error) {
    return {
      error:
        error instanceof JournalError
          ? error.message
          : "Couldn’t save. Check your connection and try again. If the game was added to your journal, it remains there.",
    };
  }
  refresh();
}

/** A single request-scoped loading boundary for all personal game content. */
export async function Playthroughs({
  gameId,
  gameTitle,
  platforms,
}: {
  gameId: number;
  gameTitle: string;
  platforms: string[];
}) {
  const userId = await signedInUserId();
  const [entry, playthroughs] = userId
    ? await Promise.all([
        journal.entry(userId, gameId),
        journal.playthroughs(userId, gameId),
      ])
    : [null, []];

  async function setStatus(
    status: Status | null,
    completionTag: CompletionTag | null,
  ) {
    "use server";
    const owner = await ownerId();
    return saveOrReturnError(() =>
      status === null
        ? journal.remove(owner, gameId)
        : journal.set(owner, gameId, { status, completionTag }),
    );
  }
  async function add(values: Record<string, string>) {
    "use server";
    const owner = await ownerId();
    return saveOrReturnError(() =>
      journal.recordPlaythrough(
        owner,
        gameId,
        fromForm(values),
        (values.status ?? "playing") as Status,
      ),
    );
  }
  async function update(id: number, values: Record<string, string>) {
    "use server";
    const owner = await ownerId();
    return saveOrReturnError(() =>
      journal.updatePlaythrough(owner, id, fromForm(values)),
    );
  }
  async function remove(id: number) {
    "use server";
    const owner = await ownerId();
    return saveOrReturnError(() => journal.removePlaythrough(owner, id));
  }
  return (
    <GameRecording
      signedIn={!!userId}
      entry={entry}
      playthroughs={playthroughs}
      gameTitle={gameTitle}
      platforms={platforms}
      onStatus={setStatus}
      onAdd={add}
      onUpdate={update}
      onRemove={remove}
    />
  );
}
