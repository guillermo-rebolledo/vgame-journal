import { and, count, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { feedback } from "@/db/schema";
import type { Email } from "@/lib/email";

type Author = { id: string; username?: string | null; email: string };
export type FeedbackInput = { type: string; message: string; path: string };
export function createFeedback(
  db: Db,
  sendEmail: (email: Email) => Promise<void>,
) {
  return async (author: Author | null, input: FeedbackInput) => {
    if (!author?.username)
      return { error: "Sign in with a username to send feedback." };
    if (!input || !["idea", "bug", "other"].includes(input.type))
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
    const type = input.type as "idea" | "bug" | "other";
    const message = input.message.trim();
    const [recent] = await db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.userId, author.id),
          sql`${feedback.createdAt} > now() - interval '1 hour'`,
        ),
      );
    if (recent.count >= 5)
      return {
        error:
          "You’ve sent 5 messages in the past hour. Please try again later.",
      };
    await db
      .insert(feedback)
      .values({ userId: author.id, type, message, path: input.path });
    if (process.env.FEEDBACK_EMAIL) {
      const label = type[0].toUpperCase() + type.slice(1);
      try {
        await sendEmail({
          to: process.env.FEEDBACK_EMAIL,
          replyTo: author.email,
          subject: `[Feedback: ${label}] @${author.username}`,
          text: `Username: @${author.username}\nType: ${label}\nPath: ${input.path}\n\n${message}`,
        });
      } catch (error) {
        console.error("Feedback email failed", error);
      }
    }
  };
}
