import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { executeBatch } from "@/db/batch";
import { feedback, user } from "@/db/schema";
import type { Email } from "@/lib/email";
import { isFeedbackType } from "@/lib/feedback-types";
import {
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";
import { redactPathname } from "@/lib/pathname";

type Author = { id: string; username?: string | null; email: string };
export type FeedbackInput = { type: string; message: string; path: string };
export function createFeedback(
  db: Db,
  sendEmail: (email: Email) => Promise<void>,
) {
  return async (author: Author | null, input: FeedbackInput) => {
    if (!author?.username)
      return { error: "Sign in with a username to send feedback." };
    if (!input || !isFeedbackType(input.type))
      return { error: "Choose Idea, Bug or Other." };
    if (
      typeof input.message !== "string" ||
      !input.message.trim() ||
      input.message.trim().length > 2000
    )
      return { error: "Write a message between 1 and 2000 characters." };
    if (
      typeof input.path !== "string" ||
      !/^\/(?!\/)[^?#\s]*$/.test(input.path)
    )
      return { error: "Invalid page path. Reopen the form and try again." };
    const path = redactPathname(input.path);
    const type = input.type;
    const message = input.message.trim();
    // Separate statements under READ COMMITTED give the count a fresh snapshot after waiting for the lock.
    let inserted: unknown[];
    try {
      inserted = await executeBatch(db, [
        sql`select ${user.id} from ${user} where ${user.id} = ${author.id} for update`,
        sql`insert into ${feedback} (user_id, type, message, path, created_at)
          select ${author.id}, ${type}, ${message}, ${path}, statement_timestamp()
          where (select count(*) from ${feedback}
                 where ${feedback.userId} = ${author.id}
                   and ${feedback.createdAt} > statement_timestamp() - interval '1 hour') < 5
          returning id`,
      ]);
    } catch (error) {
      reportOperationalError("feedback.write", operationalCode(error), error);
      return { error: "Could not send feedback. Please try again." };
    }
    if (!inserted.length)
      return {
        error:
          "You’ve sent 5 messages in the past hour. Please try again later.",
      };
    if (process.env.FEEDBACK_EMAIL) {
      const label = type[0].toUpperCase() + type.slice(1);
      try {
        await sendEmail({
          to: process.env.FEEDBACK_EMAIL,
          replyTo: author.email,
          subject: `[Feedback: ${label}] @${author.username}`,
          text: `Username: @${author.username}\nType: ${label}\nPath: ${path}\n\n${message}`,
        });
      } catch (error) {
        reportOperationalError(
          "feedback.notification",
          operationalCode(error),
          error,
        );
      }
    }
  };
}
