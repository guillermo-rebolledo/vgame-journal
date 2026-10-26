import { SettingsIcon } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { currentSession } from "@/lib/auth";

export async function UserMenu() {
  const session = await currentSession();
  if (!session)
    return (
      <Link
        href="/sign-in"
        className="text-sm underline-offset-4 hover:underline"
      >
        Sign in
      </Link>
    );

  const { image, username, name } = session.user;
  return (
    <div className="flex items-center gap-1 text-sm sm:gap-2">
      {(
        [
          ["/library", "Library"],
          ["/wishlist", "Wishlist"],
          ["/stats", "Stats"],
        ] as const
      ).map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      ))}
      {image && (
        // biome-ignore lint/performance/noImgElement: Google avatars; Next image optimization is off app-wide.
        <img
          src={image}
          alt=""
          className="size-7 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="hidden sm:inline">{username ?? name}</span>
      <SignOutButton />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Settings"
        render={<Link href="/settings" />}
        nativeButton={false}
      >
        <SettingsIcon />
      </Button>
    </div>
  );
}
