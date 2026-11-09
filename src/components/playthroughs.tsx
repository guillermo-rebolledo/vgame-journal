import { refresh, updateTag } from "next/cache";
import type { ReactNode } from "react";
import { communityRatingTag } from "@/app/games/[slug]/game";
import { GameRecording } from "@/components/game-recording";
import { ownerId, signedInUserId } from "@/lib/auth";
import {
  type CompletionTag,
  JournalError,
  journal,
  type PlaythroughInput,
  type Status,
} from "@/lib/journal";
import { RATING_SAVE_FAILED, type RatingPoints } from "@/lib/rating";

const fromForm = (values: Record<string, string>): PlaythroughInput => ({
  platform: values.platform ?? "",
  startedOn: values.startedOn ?? "",
  endedOn: values.endedOn || null,
  hours: values.hours ? Number(values.hours) : null,
  notes: values.notes ?? "",
});

async function saveOrReturnError(
  write: () => Promise<void>,
): Promise<{ error: string } | undefined>;
async function saveOrReturnError(
  write: () => Promise<boolean>,
): Promise<{ error: string } | { feedbackInvitation: true } | undefined>;
async function saveOrReturnError(
  write: () => Promise<void> | Promise<boolean>,
) {
  let feedbackInvitation = false;
  try {
    feedbackInvitation = (await write()) === true;
  } catch (error) {
    return {
      error:
        error instanceof JournalError
          ? error.message
          : "Couldn’t save. Check your connection and try again. If the game was added to your journal, it remains there.",
    };
  }
  refresh();
  if (feedbackInvitation) return { feedbackInvitation: true as const };
}

/** A single request-scoped loading boundary for all personal game content. */
export async function Playthroughs({
  gameId,
  gameTitle,
  platforms,
  listPicker,
}: {
  gameId: number;
  listPicker?: ReactNode;
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
    acknowledged = false,
  ) {
    "use server";
    const owner = await ownerId();
    if (status !== null)
      return saveOrReturnError(() =>
        journal.set(owner, gameId, { status, completionTag }),
      );
    try {
      const result = await journal.remove(owner, gameId, acknowledged);
      if (result) return result;
      // A removed Rating stops counting toward the Community rating.
      updateTag(communityRatingTag(gameId));
    } catch {
      return {
        error:
          "Couldn’t remove this game. Check your connection and try again.",
      };
    }
    refresh();
  }
  async function rate(points: RatingPoints | null) {
    "use server";
    const owner = await ownerId();
    try {
      if (points === null) await journal.clearRating(owner, gameId);
      else await journal.setRating(owner, gameId, points);
    } catch (error) {
      return {
        error:
          error instanceof JournalError ? error.message : RATING_SAVE_FAILED,
      };
    }
    // Read-your-own-writes: the page's Community rating includes this change.
    updateTag(communityRatingTag(gameId));
    refresh();
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
        values.submissionId ?? "",
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
      listPicker={listPicker}
      signedIn={!!userId}
      entry={entry}
      rating={entry?.rating ?? null}
      playthroughs={playthroughs}
      gameTitle={gameTitle}
      platforms={platforms}
      onStatus={setStatus}
      onAdd={add}
      onUpdate={update}
      onRemove={remove}
      onRate={rate}
    />
  );
}
