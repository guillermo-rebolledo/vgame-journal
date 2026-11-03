"use client";

import {
  LogInIcon,
  LogOutIcon,
  PaletteIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { authPageHref, safeReturnTo } from "@/lib/auth-continuation";

type AccountUser = {
  username?: string | null;
  name: string;
  image?: string | null;
};

const trigger =
  "inline-flex size-11 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted";

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <PaletteIcon aria-hidden />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** Avatar-triggered account menu; guests get a visible Sign in link plus a Theme / Sign in menu. Content only mounts on open, so the client-only theme never hydrates. */
export function AccountMenu({ user }: { user: AccountUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const signInHref = authPageHref(
    "/sign-in",
    pathname === "/" && params ? safeReturnTo(`/?${params}`) : "/",
  );

  if (!user)
    return (
      <div className="flex items-center gap-1">
        <Link
          href={signInHref}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Sign in
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Menu" className={trigger}>
            <UserIcon aria-hidden className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <ThemeMenu />
            <DropdownMenuItem render={<Link href={signInHref} />}>
              <LogInIcon aria-hidden />
              Sign in
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );

  const handle = user.username ? `@${user.username}` : user.name;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu, ${handle}`}
        className={trigger}
      >
        <Avatar className="size-7">
          <AvatarImage
            src={user.image ?? undefined}
            alt=""
            referrerPolicy="no-referrer"
          />
          <AvatarFallback>
            {(user.username ?? user.name).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="[overflow-wrap:anywhere]">
            Signed in as {handle}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem
          render={
            <Link
              href={user.username ? `/u/${user.username}` : "/onboarding"}
            />
          }
        >
          <UserIcon aria-hidden />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon aria-hidden />
          Settings
        </DropdownMenuItem>
        <ThemeMenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOutIcon aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
