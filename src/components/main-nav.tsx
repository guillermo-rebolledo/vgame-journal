"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DESTINATIONS = [
  ["/?search=1", "Find a game"],
  ["/library", "Library"],
  ["/wishlist", "Wishlist"],
  ["/lists", "Lists"],
  ["/stats", "Stats"],
] as const;

/** Collection navigation; the current destination is underlined and announced as the current page. */
export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex flex-wrap items-center">
        {DESTINATIONS.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              onClick={(event) => {
                if (
                  href === "/?search=1" &&
                  pathname === "/" &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  window.dispatchEvent(new Event("catalog-search-open"));
                }
              }}
              aria-current={
                pathname === href.split("?")[0] ||
                (href === "/lists" && pathname.startsWith("/lists/"))
                  ? "page"
                  : undefined
              }
              className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-md px-2 text-muted-foreground text-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
