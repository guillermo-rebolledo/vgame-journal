import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Callers render this only for the owner when Steam import is enabled. */
export function SteamImportInvitation() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="font-medium">Have games on Steam?</p>
      <p className="max-w-prose text-muted-foreground text-sm">
        Choose games to add to your Backlog. Your existing Journal entries stay
        unchanged.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/?search=1"
          className={buttonVariants({ className: "min-h-11" })}
        >
          Find a game
        </Link>
        <Link
          href="/settings/steam"
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11",
          })}
        >
          Import from Steam
        </Link>
      </div>
    </div>
  );
}
