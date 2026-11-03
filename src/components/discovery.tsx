import { connection } from "next/server";
import {
  DiscoveryContent,
  type DiscoveryResult,
} from "@/components/discovery-content";
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
          <div className="h-7 w-44 max-w-full rounded bg-muted" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((tile) => (
              <div key={tile} className="flex flex-col gap-2">
                <div className="aspect-[264/374] rounded-lg bg-muted" />
                <div className="h-5 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
