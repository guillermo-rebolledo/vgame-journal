import { AccountMenu } from "@/components/account-menu";
import { Feedback } from "@/components/feedback";
import { MainNav } from "@/components/main-nav";
import { db } from "@/db";
import { currentSession } from "@/lib/auth";
import { sendWithResend } from "@/lib/email";
import { createFeedback, type FeedbackInput } from "@/lib/feedback";

/** Collection navigation plus the account menu; on phones the navigation wraps onto its own row. */
export async function UserMenu() {
  const session = await currentSession();
  if (!session) return <AccountMenu user={null} />;

  async function submitFeedback(input: FeedbackInput) {
    "use server";
    const current = await currentSession();
    return createFeedback(db, sendWithResend)(current?.user ?? null, input);
  }

  const { image, username, name } = session.user;
  return (
    <>
      <MainNav className="order-last -ml-2 w-full sm:order-none sm:mr-auto sm:ml-0 sm:w-auto" />
      <div className="ml-auto flex items-center gap-2">
        <Feedback username={username} onSubmit={submitFeedback} />
        <AccountMenu user={{ username, name, image }} />
      </div>
    </>
  );
}
