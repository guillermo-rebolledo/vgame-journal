import { SettingsIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { currentSession } from "@/lib/auth";

/** Collection navigation plus a separate account group; on phones the navigation wraps onto its own row. */
export async function UserMenu() {
  const session = await currentSession();
  if (!session)
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Sign in
        </Link>
        <ThemeToggle />
      </div>
    );

  const { image, username, name } = session.user;
  return (
    <>
      <MainNav className="order-last -ml-2 w-full sm:order-none sm:mr-auto sm:ml-0 sm:w-auto" />
      <div className="ml-auto flex items-center gap-1">
        <Link
          href={username ? `/u/${username}` : "/onboarding"}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 lg:px-2"
        >
          {image ? (
            // biome-ignore lint/performance/noImgElement: Google avatars; Next image optimization is off app-wide.
            <img
              src={image}
              alt=""
              className="size-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon aria-hidden className="size-4 lg:hidden" />
          )}
          <span className="sr-only lg:not-sr-only">{username ?? name}</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          className="size-11"
          render={<Link href="/settings" />}
          nativeButton={false}
        >
          <SettingsIcon />
        </Button>
        <ThemeToggle />
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <SignOutButton />
      </div>
    </>
  );
}
