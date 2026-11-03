"use server";

import { signedInUserId } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
import { type HomeSnapshot, homeEntries } from "@/lib/home-journal";
import { JournalError, journal } from "@/lib/journal";
import { STATUSES, type Status } from "@/lib/library";

export async function readHomeJournal(): Promise<HomeSnapshot> {
  const owner = await signedInUserId();
  return {
    owner,
    entries: owner ? homeEntries(await journal.library(owner)) : [],
  };
}

export async function homeIntentGame(gameId: number, slug: string) {
  if (
    !Number.isSafeInteger(gameId) ||
    gameId <= 0 ||
    typeof slug !== "string" ||
    slug.length > 200
  )
    return null;
  const game = await catalog.findBySlug(slug);
  return game?.id === gameId
    ? { gameId, slug: game.slug, title: game.title }
    : null;
}

export async function saveHomeStatus(
  expectedOwner: string,
  gameId: number,
  slug: string,
  status: Status,
) {
  const owner = await signedInUserId();
  if (!owner || owner !== expectedOwner)
    return { snapshot: { owner, entries: null }, authRequired: true };
  try {
    if (!STATUSES.includes(status))
      throw new JournalError("Choose a valid Journal status.");
    if (!(await homeIntentGame(gameId, slug)))
      throw new JournalError(
        "This game could not be found. Search for it again.",
      );
    const current = await journal.entry(owner, gameId);
    // A status-only selection must preserve the completion tag on an unchanged Played entry.
    if (current?.status !== status)
      await journal.set(owner, gameId, { status });
  } catch (error) {
    const snapshot = await readHomeJournal().catch(() => ({
      owner,
      entries: null,
    }));
    return {
      snapshot,
      error:
        error instanceof JournalError
          ? error.message
          : "Couldn’t confirm the save. Your Journal has been checked where possible; try again.",
    };
  }
  return { snapshot: await readHomeJournal() };
}
