import { connection } from "next/server";
import { CoverTiles } from "@/components/content-loading";
import {
  DiscoveryContent,
  type DiscoveryResult,
} from "@/components/discovery-content";
import { Skeleton } from "@/components/ui/skeleton";
import { catalog } from "@/lib/catalog";

/** Reads durable snapshots only; retries never refresh the provider or write to the Catalog. */
export async function Discovery() {
  await connection();
  let result: DiscoveryResult;
  try {
    result = { shelves: await catalog.discovery() };
  } catch {
    console.error("Home discovery unavailable");
    result = { error: true };
  }
  return <DiscoveryContent result={result} />;
}

export function DiscoveryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <output className="text-muted-foreground text-sm">
        Loading discovery picks…
      </output>
      {["recent", "popular"].map((key) => (
        <div key={key} aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-7 w-44" />
          <CoverTiles />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}
