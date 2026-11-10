"use server";

import { refresh } from "next/cache";
import { ownerId } from "@/lib/auth";
import { ExpectedError } from "@/lib/expected-error";
import { steamImport, steamImportEnabled } from "@/lib/steam-server";

async function owner(expectedOwner: string) {
  const current = await ownerId();
  if (current !== expectedOwner)
    throw new ExpectedError(
      "Your account changed. Reload this page before importing.",
    );
  return current;
}
export async function readSteamImport(expectedOwner: string) {
  const id = await owner(expectedOwner);
  if (!(await steamImportEnabled())) return { kind: "unavailable" as const };
  return steamImport.review(id);
}
export async function commitSteamImport(
  expectedOwner: string,
  appids: number[],
) {
  try {
    const id = await owner(expectedOwner);
    if (!(await steamImportEnabled()))
      throw new ExpectedError("Steam import is not available yet.");
    const result = await steamImport.commit(id, appids);
    refresh();
    return result;
  } catch (error) {
    return {
      error:
        error instanceof ExpectedError
          ? error.message
          : "Could not confirm the import. Keep your selection and retry in one minute; entries already saved will be skipped.",
    };
  }
}
export async function disconnectSteam(expectedOwner: string) {
  try {
    await steamImport.unlink(await owner(expectedOwner));
    refresh();
    return { disconnected: true as const };
  } catch {
    return { error: "Could not disconnect Steam. Please try again." };
  }
}
