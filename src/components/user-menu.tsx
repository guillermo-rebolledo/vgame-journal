import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
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
    <div className="flex items-center gap-2 text-sm">
      {image && (
        // biome-ignore lint/performance/noImgElement: Google avatars; Next image optimization is off app-wide.
        <img
          src={image}
          alt=""
          className="size-7 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      <span>{username ?? name}</span>
      <SignOutButton />
    </div>
  );
}
