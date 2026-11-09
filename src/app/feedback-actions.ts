"use server";

import { db } from "@/db";
import { currentSession } from "@/lib/auth";
import { sendWithResend } from "@/lib/email";
import { createFeedback, type FeedbackInput } from "@/lib/feedback";

export async function submitFeedback(input: FeedbackInput) {
  const session = await currentSession();
  return createFeedback(db, sendWithResend)(session?.user ?? null, input);
}
