"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} default="none" enter="route" exit="route">
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
