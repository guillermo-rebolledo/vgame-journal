"use client";

import { type ReactNode, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 48;

/** Bound mounted rows without estimating heights or removing keyboard-accessible items. */
// shortcut: collection data stays in memory; move paging to server cursors if payload size becomes the bottleneck.
export function PagedList<T>({
  items,
  label,
  children,
}: {
  items: readonly T[];
  label: string;
  children: (items: readonly T[], offset: number) => ReactNode;
}) {
  const [requestedPage, setPage] = useState(0);
  const [pending, startTransition] = useTransition();
  const page = Math.min(
    requestedPage,
    Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1),
  );
  const offset = page * PAGE_SIZE;
  const contentId = useId();
  const content = useRef<HTMLFieldSetElement>(null);

  function changePage(next: number) {
    startTransition(() => setPage(next));
    content.current?.focus({ preventScroll: true });
    content.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="space-y-4">
      <fieldset
        id={contentId}
        ref={content}
        aria-label={label}
        aria-busy={pending}
        tabIndex={-1}
        className="min-w-0 scroll-mt-4 outline-none"
      >
        {children(items.slice(offset, offset + PAGE_SIZE), offset)}
      </fieldset>
      {items.length > PAGE_SIZE && (
        <nav
          aria-label={`${label} pages`}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <output className="text-muted-foreground text-sm tabular-nums">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, items.length)} of{" "}
            {items.length}
          </output>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              aria-controls={contentId}
              disabled={pending || page === 0}
              onClick={() => changePage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              aria-controls={contentId}
              disabled={pending || offset + PAGE_SIZE >= items.length}
              onClick={() => changePage(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
