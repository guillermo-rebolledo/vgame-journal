"use client";

import { useSearchParams } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { parsePage } from "@/lib/pagination";

const PAGE_SIZE = 48;

/** Opt in with a stable collection key. Leave totalItems undefined until data is loaded. */
export function useUrlPagination(pageKey: string, totalItems?: number) {
  const params = useSearchParams();
  const query = params.toString();
  const raw = params.get(pageKey);
  const requested = parsePage(raw);
  const page =
    totalItems === undefined
      ? requested
      : Math.min(requested, Math.max(1, Math.ceil(totalItems / PAGE_SIZE)));

  useEffect(() => {
    // Deferred filters and lazy collections must not clamp against stale or unloaded data.
    if (
      totalItems === undefined ||
      new URLSearchParams(window.location.search).toString() !== query
    )
      return;
    const canonical = page === 1 ? null : String(page);
    if (raw !== canonical) writePage(pageKey, page, "replaceState");
  }, [pageKey, totalItems, query, raw, page]);

  return {
    page,
    onPageChange: (next: number) => writePage(pageKey, next, "pushState"),
  };
}

function writePage(
  key: string,
  page: number,
  method: "pushState" | "replaceState",
) {
  const url = new URL(window.location.href);
  if (page === 1) url.searchParams.delete(key);
  else url.searchParams.set(key, String(page));
  window.history[method](null, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Bound mounted rows without estimating heights or removing keyboard-accessible items. */
// shortcut: collection data stays in memory; move paging to server cursors if payload size becomes the bottleneck.
export function PagedList<T>({
  items,
  label,
  children,
  pagination,
}: {
  items: readonly T[];
  label: string;
  pagination?: ReturnType<typeof useUrlPagination>;
  children: (items: readonly T[], offset: number) => ReactNode;
}) {
  const [requestedPage, setPage] = useState(0);
  const [pending, startTransition] = useTransition();
  const page = Math.min(
    pagination ? pagination.page - 1 : requestedPage,
    Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1),
  );
  const offset = page * PAGE_SIZE;
  const contentId = useId();
  const content = useRef<HTMLFieldSetElement>(null);

  function changePage(next: number) {
    startTransition(() => {
      if (pagination) pagination.onPageChange(next + 1);
      else setPage(next);
    });
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
          <div className="flex flex-wrap gap-2">
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
