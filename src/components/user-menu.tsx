import { submitFeedback } from "@/app/feedback-actions";
import { AccountMenu } from "@/components/account-menu";
import { MainNav } from "@/components/main-nav";
import { currentSession } from "@/lib/auth";

/** Collection navigation plus the account menu; on phones the navigation wraps onto its own row. */
export async function UserMenu() {
  const session = await currentSession();
  if (!session) return <AccountMenu user={null} />;

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
