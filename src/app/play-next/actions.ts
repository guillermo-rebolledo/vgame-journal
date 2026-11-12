"use server";

import { signedInUserId } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
import { journal } from "@/lib/journal";
import {
  type PlayNextGame,
  type PlayNextRequest,
  type PlayNextSnapshot,
  validPlayNextRequest,
} from "@/lib/play-next";
import { createPlayNext } from "@/lib/play-next-server";
import { recommendationPage, recommendationSeeds } from "./provider";

export async function loadPlayNext(
  expectedOwner: string,
  request: PlayNextRequest,
) {
  const owner = await signedInUserId();
  if (!owner || owner !== expectedOwner)
    return {
      owner: owner ?? "",
      source: "backlog",
      provenance: "backlog",
      backlogCount: 0,
      games: [],
      bounded: false,
      platforms: [],
      genres: [],
    } satisfies PlayNextSnapshot;
  if (!validPlayNextRequest(request)) throw new Error("Choose valid filters.");
  const read = createPlayNext({
    ...catalog,
    playNextSeeds: recommendationSeeds,
    playNextPage: recommendationPage,
  });
  const snapshot = await read(owner, request);
  if ((await signedInUserId()) !== owner)
    throw new Error("Your session changed. Reload your suggestions.");
  return snapshot;
}

export async function savePlayNext(
  expectedOwner: string,
  selection: Pick<PlayNextGame, "id" | "slug" | "updatedAt">,
  status: "backlog" | "playing",
) {
  const owner = await signedInUserId();
  if (!owner || owner !== expectedOwner) return { authRequired: true };
  try {
    if (
      !selection ||
      !Number.isSafeInteger(selection.id) ||
      selection.id <= 0 ||
      typeof selection.slug !== "string" ||
      !/^[a-z0-9-]{1,200}$/.test(selection.slug) ||
      !["playing", "backlog"].includes(status)
    )
      return { error: "This choice is invalid. Reload suggestions." };
    const game = await catalog.findBySlug(selection.slug);
    if (!game || game.id !== selection.id)
      return { error: "This game could not be found. Try again." };
    if (selection.updatedAt !== null) {
      if (
        status !== "playing" ||
        typeof selection.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(selection.updatedAt))
      )
        return { error: "Reload this choice before saving." };
      if (
        !(await journal.move(
          owner,
          game.id,
          { status: "backlog", updatedAt: new Date(selection.updatedAt) },
          "playing",
        ))
      )
        return {
          error:
            "This game's Status changed in another tab. Reload suggestions before choosing again.",
        };
    } else if (!(await journal.addRecommendation(owner, game.id, status))) {
      return {
        error:
          "This game is already in your Journal. Reload suggestions to see its current Status.",
      };
    }
    return {};
  } catch {
    return {
      error:
        "Couldn’t confirm the save. Your choice is kept; retry or reload suggestions to check your Journal.",
    };
  }
}
