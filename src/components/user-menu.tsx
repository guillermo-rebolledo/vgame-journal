import { AccountMenu } from "@/components/account-menu";
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
    <div className="ml-auto flex w-full items-start gap-2 sm:w-auto">
      <MainNav className="-ml-2 min-w-0 flex-1 sm:ml-0" />
      <div className="shrink-0">
        <AccountMenu
          user={{ username, name, image }}
          onSubmitFeedback={submitFeedback}
        />
      </div>
    </div>
  );
}
