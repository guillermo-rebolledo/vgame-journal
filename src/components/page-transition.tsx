"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState, ViewTransition } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
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
