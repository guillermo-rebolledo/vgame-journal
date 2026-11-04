"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
  AnchoredSearch,
  GameIdentity,
  GameLink,
  RowActions,
  SearchField,
  SearchFooter,
  SearchState,
  useSearchDemo,
  useSearchShortcut,
  type VariantProps,
} from "./shared";

export function QuickAdd(props: VariantProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const demo = useSearchDemo(props);
  useSearchShortcut(setOpen);
  return (
    <AnchoredSearch open={open} setOpen={setOpen}>
      <SearchField demo={demo} />
      <Separator />
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <p className="px-4 pt-3 pb-1 text-muted-foreground text-xs">
          {demo.query
            ? `${demo.matches.length} matching games`
            : "Explore the Catalog"}
        </p>
        <SearchState demo={demo}>
          <ul aria-label="Search results" className="p-2">
            {demo.matches.map((game) => (
              <li
                key={game.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg p-2 hover:bg-muted/50"
              >
                <div className="flex min-w-40 flex-1 items-center gap-3">
                  <GameIdentity game={game} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RowActions game={game} demo={demo} />
                  <GameLink game={game} />
                </div>
              </li>
            ))}
          </ul>
        </SearchState>
      </div>
      <SearchFooter
        demo={demo}
        hint="Save a few games without leaving search"
      />
    </AnchoredSearch>
  );
}
