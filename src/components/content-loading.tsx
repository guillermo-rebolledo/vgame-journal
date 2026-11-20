import { cn } from "cn";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function LoadingContent({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-6", className)}>
      <output className="sr-only">{label}</output>
      <div aria-hidden="true" className="space-y-6">
        {children}
      </div>
    </div>
  );
}

function GameRows() {
  return (
    <div className="divide-y divide-border/60">
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
  );
}

/** Reserves the Catalog search panel's footprint so Home doesn't jump when it mounts. */
export function HomeSearchLoading() {
  return <Skeleton className="h-20 w-full rounded-xl" />;
}

/** The cover grid Home shelves and Discovery resolve into. */
export function CoverTiles() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[0, 1, 2, 3].map((tile) => (
        <div key={tile} className="flex flex-col gap-2">
          <Skeleton className="aspect-[264/374] w-full rounded-lg" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function HomeCollectionsLoading() {
  return (
    <LoadingContent label="Checking Journal status…">
      <div className="space-y-4 border-t pt-6">
        <Skeleton className="h-7 w-40" />
        <CoverTiles />
      </div>
    </LoadingContent>
  );
}

/** One shelf per Discovery section, matching `DiscoveryLoading`'s two shelves. */
function DiscoveryShelves() {
  return (
    <div className="flex flex-col gap-6">
      {["recent", "popular"].map((key) => (
        <div key={key} className="flex flex-col gap-3">
          <Skeleton className="h-7 w-44" />
          <CoverTiles />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export function HomeLoading() {
  return (
    <LoadingContent label="Opening your Journal…">
      <Skeleton className="h-9 w-56 max-w-full" />
      <HomeSearchLoading />
      <div className="space-y-4 border-t pt-6">
        <Skeleton className="h-7 w-40" />
        <CoverTiles />
      </div>
      {/* Home always resolves into Discovery below the shelves; reserving it keeps the page from growing. */}
      <DiscoveryShelves />
    </LoadingContent>
  );
}

export function ListsLoading() {
  return (
    <LoadingContent label="Loading your lists…" className="col-span-full">
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <div key={card} className="space-y-4 rounded-lg border p-4">
            <div className="grid max-w-56 grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((cover) => (
                <Skeleton key={cover} className="aspect-[264/374] w-full" />
              ))}
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </LoadingContent>
  );
}

export function ListLoading({
  label = "Loading your list…",
}: {
  label?: string;
}) {
  return (
    <LoadingContent label={label}>
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-11 w-32" />
      </div>
      <GameRows />
    </LoadingContent>
  );
}

export function ProfileLoading() {
  return (
    <LoadingContent label="Loading profile…">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-9 w-48 max-w-full" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 border-b pb-3">
        {[0, 1, 2, 3].map((tab) => (
          <Skeleton key={tab} className="h-11 w-20" />
        ))}
      </div>
      <GameRows />
    </LoadingContent>
  );
}

export function StatsLoading() {
  return (
    <LoadingContent label="Loading stats…">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
        {[0, 1].map((chart) => (
          <div key={chart} className="space-y-6 border-t pt-6">
            <Skeleton className="h-7 w-48 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
            {["w-3/4", "w-full", "w-1/2"].map((width) => (
              <div key={width} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className={cn("h-3", width)} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-6 border-t pt-6">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="aspect-[18/5] w-full" />
      </div>
    </LoadingContent>
  );
}

export function SettingLoading({ label }: { label: string }) {
  return (
    <LoadingContent label={label} className="border-t pt-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-8 w-24" />
    </LoadingContent>
  );
}

export function ProfileVisibilityLoading() {
  return (
    <LoadingContent label="Loading profile visibility…">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-11 w-24" />
      </div>
    </LoadingContent>
  );
}

export function HeaderLoading() {
  return (
    <LoadingContent
      label="Loading account navigation…"
      className="ml-auto w-full sm:w-auto"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 sm:hidden" />
        <Skeleton className="size-11 rounded-full" />
      </div>
    </LoadingContent>
  );
}

/**
 * Reserves the "More like …" shelf: tag pills, caption and the six-cover grid.
 * Without the grid's footprint the footer jumped when similar games arrived.
 */
export function TagShelvesLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-4 px-4 pt-4 pb-12">
      <output className="flex items-center gap-2 text-muted-foreground text-sm">
        <Spinner />
        <span className="shimmer">Loading similar games…</span>
      </output>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Skeleton className="h-7 w-48 max-w-full" />
        <div className="flex gap-2 py-1">
          {[0, 1, 2].map((pill) => (
            <Skeleton key={pill} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-5 w-56 max-w-full" />
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((cover) => (
            <div key={cover} className="flex flex-col gap-2">
              <Skeleton className="aspect-[264/374] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
