"use server";

import { revalidatePath } from "next/cache";
import { currentSession } from "@/lib/auth";
import { yearInReviewFlag } from "@/lib/flags";
import { reviewInvitation } from "@/lib/review-invitation";

/** A client mount records an actual visit; an RSC prefetch must never mark it viewed. */
export async function markReviewViewed(expectedOwner: string) {
  const session = await currentSession();
  if (
    !session ||
    session.user.id !== expectedOwner ||
    !(await yearInReviewFlag())
  )
    return;
  if (await reviewInvitation.viewed(session.user.id)) revalidatePath("/");
}

export async function dismissReviewInvitation(
  expectedOwner: string,
  duration: "session" | "year",
) {
  const session = await currentSession();
  if (!session || session.user.id !== expectedOwner)
    return "Sign in again to change this banner.";
  if (!(await yearInReviewFlag())) return "This review is no longer available.";
  if (duration !== "session" && duration !== "year")
    return "Choose how long to hide this banner.";
  try {
    if (duration === "year") await reviewInvitation.hide(session.user.id);
    else await reviewInvitation.dismiss(session.user.id, session.session.id);
    revalidatePath("/");
    return null;
  } catch {
    return "Couldn’t save your choice. Please try again.";
  }
}
