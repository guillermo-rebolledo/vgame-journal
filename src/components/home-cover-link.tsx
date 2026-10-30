"use client";

import Link from "next/link";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useState,
  ViewTransition,
} from "react";
import { flushSync } from "react-dom";
import { type ProductEvent, trackEvent } from "@/components/analytics";

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
  event,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  gameId: number;
  source: "search" | "shelf";
  cover: ReactNode;
  /** Recorded when the link is opened. */
  event?: ProductEvent;
}) {
  const selection = useContext(Selection);
  const instance = useId();
  const id = `${source}-${gameId}-${instance}`;
  return (
    <Link
      {...props}
      onClick={(e) => {
        if (event) trackEvent(...event);
        props.onClick?.(e);
      }}
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
