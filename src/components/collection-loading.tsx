/** Static placeholders avoid distracting motion and work with reduced motion. */
export function CollectionLoading({
  collection,
}: {
  collection: "Library" | "Wishlist";
}) {
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
            <div className="aspect-[264/374] w-14 shrink-0 rounded bg-muted" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="h-4 w-2/3 max-w-64 rounded bg-muted" />
              <div className="h-3 w-1/3 max-w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
