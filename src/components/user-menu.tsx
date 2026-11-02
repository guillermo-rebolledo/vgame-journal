import { AccountMenu } from "@/components/account-menu";
import { MainNav } from "@/components/main-nav";
import { currentSession } from "@/lib/auth";

/** Collection navigation plus the account menu; on phones the navigation wraps onto its own row. */
export async function UserMenu() {
  const session = await currentSession();
  if (!session) return <AccountMenu user={null} />;

  const { image, username, name } = session.user;
  return (
    <>
      <MainNav className="order-last -ml-2 w-full sm:order-none sm:mr-auto sm:ml-0 sm:w-auto" />
      <div className="ml-auto flex items-center">
        <AccountMenu user={{ username, name, image }} />
      </div>
    </>
  );
}
