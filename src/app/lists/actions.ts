"use server";

import { revalidatePath } from "next/cache";
import { signedInUserId } from "@/lib/auth";
import {
  type CreateListInput,
  type EditListInput,
  type ListFailure,
  type ListResult,
  lists,
  type OwnerList,
} from "@/lib/lists";

const authentication: ListFailure = {
  ok: false,
  code: "authentication",
  message:
    "Your session expired or changed. Sign in with the original account to continue. Your draft is kept.",
};
const unavailable: ListFailure = {
  ok: false,
  code: "unavailable",
  message:
    "Couldn’t confirm the save. Your input is kept. Refresh the saved list before retrying.",
};

export async function readOwnerLists(
  expectedActor: string,
): Promise<ListResult<OwnerList[]>> {
  const actor = await signedInUserId();
  if (!actor || actor !== expectedActor) return authentication;
  try {
    return { ok: true, value: await lists.ownerCollection(actor) };
  } catch {
    return unavailable;
  }
}

export async function readOwnerList(
  expectedActor: string,
  id: string,
): Promise<ListResult<OwnerList | null>> {
  const actor = await signedInUserId();
  if (!actor || actor !== expectedActor) return authentication;
  try {
    return { ok: true, value: await lists.ownerDetail(actor, id) };
  } catch {
    return unavailable;
  }
}

function invalidate(id: string) {
  revalidatePath("/lists");
  revalidatePath(`/lists/${id}`);
  revalidatePath("/u/[username]", "page");
  revalidatePath("/u/[username]/lists/[listId]", "page");
}

export async function createOwnerList(
  expectedActor: string,
  input: CreateListInput,
): Promise<ListResult<OwnerList>> {
  const actor = await signedInUserId();
  if (!actor || actor !== expectedActor) return authentication;
  const result = await lists.create(actor, input);
  if (result.ok) invalidate(result.value.id);
  return result;
}

export async function editOwnerList(
  expectedActor: string,
  id: string,
  revision: number,
  input: EditListInput,
): Promise<ListResult<OwnerList>> {
  const actor = await signedInUserId();
  if (!actor || actor !== expectedActor) return authentication;
  const result = await lists.edit(actor, id, revision, input);
  if (!result.ok) return result;
  invalidate(id);
  try {
    const value = await lists.ownerDetail(actor, id);
    return value
      ? { ok: true, value }
      : { ok: false, code: "not_found", message: "List not found." };
  } catch {
    return unavailable;
  }
}

export type ListChange =
  | { kind: "add" | "remove"; gameId: number }
  | { kind: "reorder"; gameIds: number[] }
  | { kind: "visibility"; visibility: "private" | "public" }
  | { kind: "delete" };

export async function changeOwnerList(
  expectedActor: string,
  id: string,
  revision: number,
  change: ListChange,
): Promise<ListResult<OwnerList | null>> {
  const actor = await signedInUserId();
  if (!actor || actor !== expectedActor) return authentication;
  if (
    !change ||
    !["add", "remove", "reorder", "visibility", "delete"].includes(change.kind)
  )
    return {
      ok: false,
      code: "validation",
      message: "Choose a valid list operation.",
    };
  const result =
    change.kind === "delete"
      ? await lists.delete(actor, id, revision)
      : change.kind === "visibility"
        ? await lists.setVisibility(actor, id, revision, change.visibility)
        : change.kind === "reorder"
          ? await lists.reorder(actor, id, revision, change.gameIds)
          : change.kind === "add"
            ? await lists.addGame(actor, id, revision, change.gameId)
            : await lists.removeGame(actor, id, revision, change.gameId);
  if (!result.ok) return result;
  invalidate(id);
  if (change.kind === "delete") return { ok: true, value: null };
  try {
    const value = await lists.ownerDetail(actor, id);
    return value
      ? { ok: true, value }
      : { ok: false, code: "not_found", message: "List not found." };
  } catch {
    return unavailable;
  }
}
