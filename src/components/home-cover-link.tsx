"use client";

import Link from "next/link";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useState,
  ViewTransition,
} from "react";
import { flushSync } from "react-dom";

const Selection = createContext<{
  active: string | null;
  select: (id: string) => void;
} | null>(null);

/** Search and shelves can show the same game; only the clicked cover gets its shared name. */
export function HomeCoverTransitions({ children }: { children: ReactNode }) {
  const [active, select] = useState<string | null>(null);
  return <Selection value={{ active, select }}>{children}</Selection>;
}

export function HomeCoverLink({
  gameId,
  source,
  cover,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  gameId: number;
  source: "search" | "shelf";
  cover: ReactNode;
}) {
  const selection = useContext(Selection);
  const id = `${source}-${gameId}`;
  return (
    <Link
      {...props}
      // Set the source before Next snapshots the outgoing page, including keyboard navigation.
      onNavigate={() => flushSync(() => selection?.select(id))}
    >
      <ViewTransition
        name={
          !selection || selection.active === id
            ? `game-cover-${gameId}`
            : undefined
        }
        default="none"
        share="cover-morph"
      >
        {cover}
      </ViewTransition>
      {children}
    </Link>
  );
}
