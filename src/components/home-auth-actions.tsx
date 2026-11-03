"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { authPageHref, safeReturnTo } from "@/lib/auth-continuation";

/** Return to browsing after auth; this carries no Journal mutation intent. */
export function HomeAuthActions() {
  const params = useSearchParams().toString();
  const returnTo = safeReturnTo(params ? `/?${params}` : "/");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={authPageHref("/sign-up", returnTo)}
        className={buttonVariants({
          variant: "default",
          className: "min-h-11 h-auto whitespace-normal px-4 py-2",
        })}
      >
        Sign up to start a Journal
      </Link>
      <Link
        href={authPageHref("/sign-in", returnTo)}
        className={buttonVariants({
          variant: "ghost",
          className: "min-h-11 h-auto whitespace-normal py-2",
        })}
      >
        Sign in to your Journal
      </Link>
    </div>
  );
}
