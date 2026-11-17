"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requestCatalogSearch } from "@/lib/catalog-search-navigation";

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
  const current = (href: string) =>
    pathname === href.split("?")[0] ||
    (href === "/lists" && pathname.startsWith("/lists/"))
      ? ("page" as const)
      : undefined;
  const more = DESTINATIONS.slice(3);
  const additionalPage = more.find(([href]) => current(href));
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex flex-wrap items-center">
        {DESTINATIONS.map(([href, label], index) => (
          <li key={href} className={index >= 3 ? "hidden sm:block" : undefined}>
            <Link
              href={href}
              onClick={(event) => {
                if (
                  href === "/?search=1" &&
                  event.button === 0 &&
                  !event.defaultPrevented &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  requestCatalogSearch(event.currentTarget);
                  if (pathname === "/") event.preventDefault();
                }
              }}
              aria-current={current(href)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-md px-1 text-muted-foreground sm:px-2 text-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2"
            >
              {label}
            </Link>
          </li>
        ))}
        <li className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11 gap-1 px-1 text-muted-foreground data-[current]:text-foreground data-[current]:underline"
                  data-current={additionalPage ? "" : undefined}
                  aria-label={
                    additionalPage
                      ? `More, current page ${additionalPage[1]}`
                      : "More"
                  }
                  press="static"
                />
              }
            >
              More{" "}
              <ChevronDown
                aria-hidden="true"
                className="hidden min-[360px]:inline"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {more.map(([href, label]) => (
                <DropdownMenuItem
                  key={href}
                  render={<Link href={href} aria-current={current(href)} />}
                  className="min-h-11 px-2 aria-[current=page]:font-medium aria-[current=page]:underline"
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}
