"use client";

import Link from "next/link";
import { trackEvent } from "@/components/analytics";
import { buttonVariants } from "@/components/ui/button";

/** Home renders this for an empty Journal when Steam import is enabled. */
export function SteamImportInvitation() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="font-medium">Have games on Steam?</p>
      <p className="max-w-prose text-muted-foreground text-sm">
        Choose games to add to your Backlog. Your existing Journal entries stay
        unchanged.
      </p>
      <Link
        href="/settings/steam"
        onClick={() => trackEvent("steam_import_opened", { surface: "home" })}
        className={buttonVariants({
          variant: "outline",
          className: "min-h-11",
        })}
      >
        Import from Steam
      </Link>
    </div>
  );
}
