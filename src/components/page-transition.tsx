"use client";

import { usePathname } from "next/navigation";
import {
  type ReactNode,
  Suspense,
  useEffect,
  useState,
  ViewTransition,
} from "react";

/**
 * The pathname read, kept in the smallest leaf. On a route whose params are not
 * known at build time `usePathname` suspends, so reading it any higher hands the
 * whole page to the nearest boundary's fallback.
 */
function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Change the snapshot name, not the React key: Next keeps visited pages mounted.
  const [settledPathname, setSettledPathname] = useState(pathname);
  useEffect(() => setSettledPathname(pathname), [pathname]);

  return (
    <ViewTransition
      name={`route-${Array.from(pathname, (char) => char.codePointAt(0)?.toString(16)).join("-")}`}
      default="none"
      enter="route"
      exit="route"
      update={pathname === settledPathname ? "none" : "route"}
    >
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  // The fallback is the same tree without the transition wrapper, so a prerendered
  // shell keeps each page's own skeleton instead of collapsing to a page spinner.
  return (
    <Suspense fallback={<div className="flex flex-1 flex-col">{children}</div>}>
      <RouteTransition>{children}</RouteTransition>
    </Suspense>
  );
}
