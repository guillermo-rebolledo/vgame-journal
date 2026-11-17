import { Skeleton } from "@/components/ui/skeleton";

/** Static placeholders avoid distracting motion and work with reduced motion. */
export function CollectionLoading({
  collection,
}: {
  collection: "Library" | "Wishlist";
}) {
  if (collection === "Library")
    return (
      <div className="flex flex-col gap-3">
        <output className="sr-only">Loading your Library…</output>
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-3 sm:max-w-sm">
            <Skeleton className="h-17 w-full" />
            <Skeleton className="h-17 w-full" />
          </div>
          <Skeleton className="h-11 w-32 sm:pointer-fine:h-8" />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Skeleton className="h-11 w-60 sm:pointer-fine:h-8" />
            <div className="min-h-11 basis-full sm:basis-auto" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {[0, 1, 2].map((tile) => (
              <div key={tile} className="space-y-2">
                <Skeleton className="aspect-[264/374] w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <output aria-live="polite" className="text-muted-foreground text-sm">
        Loading your {collection}…
      </output>
      <div
        aria-hidden="true"
        className="flex flex-col divide-y divide-border/60"
      >
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-4 py-4">
            <Skeleton className="aspect-[264/374] w-14 shrink-0" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-4 w-2/3 max-w-64" />
              <Skeleton className="h-3 w-1/3 max-w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
