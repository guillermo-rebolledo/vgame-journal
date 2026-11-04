"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useState } from "react";
import { GameCover } from "@/components/game-cover";
import { Separator } from "@/components/ui/separator";
import {
  AnchoredSearch,
  DetailActions,
  type Game,
  GameIdentity,
  SearchField,
  SearchFooter,
  SearchState,
  useSearchDemo,
  useSearchShortcut,
  type VariantProps,
} from "./shared";

export function Inspector(props: VariantProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const demo = useSearchDemo(props);
  const [selectedId, setSelectedId] = useState(1);
  const selected =
    demo.matches.find((game) => game.id === selectedId) ?? demo.matches[0];
  useSearchShortcut(setOpen);
  return (
    <AnchoredSearch open={open} setOpen={setOpen} wide>
      <Combobox.Root<Game>
        inline
        open
        autoHighlight
        items={demo.matches}
        filter={null}
        inputValue={demo.query}
        onInputValueChange={demo.setQuery}
        itemToStringLabel={(game) => game.title}
        onItemHighlighted={(game) => {
          if (game) setSelectedId(game.id);
        }}
        onValueChange={(game, event) => {
          if (game) setSelectedId(game.id);
          event.cancel();
        }}
      >
        <SearchField demo={demo} combobox />
        <Separator />
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <SearchState demo={demo}>
            <div className="grid sm:grid-cols-[1fr_18rem]">
              <div className="min-w-0">
                <p className="px-4 pt-3 pb-1 text-muted-foreground text-xs">
                  {demo.query
                    ? `${demo.matches.length} matching games`
                    : "Explore the Catalog"}
                </p>
                <Combobox.List
                  aria-label="Search results"
                  className="max-h-48 overflow-y-auto overscroll-contain p-2 sm:max-h-80"
                >
                  {(game: Game) => (
                    <Combobox.Item
                      key={game.id}
                      value={game}
                      className="flex min-h-16 cursor-default items-center gap-3 rounded-lg p-2 outline-none data-highlighted:bg-muted"
                    >
                      <GameIdentity game={game} />
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </div>
              {selected && (
                <section
                  aria-label={`Actions for ${selected.title}`}
                  className="flex flex-col gap-4 border-border border-t bg-muted/30 p-4 sm:border-t-0 sm:border-l"
                >
                  <div className="flex items-start gap-3">
                    <GameCover
                      imageId={selected.image}
                      size="cover_small"
                      className="w-12 rounded-md"
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <h2 className="break-words font-medium">
                        {selected.title}
                      </h2>
                      <p className="text-muted-foreground text-xs">
                        {selected.year ?? "Release unannounced"}
                      </p>
                    </div>
                  </div>
                  <DetailActions game={selected} demo={demo} />
                </section>
              )}
            </div>
          </SearchState>
        </div>
      </Combobox.Root>
      <SearchFooter demo={demo} hint="↑ ↓ to preview · tab to reach actions" />
    </AnchoredSearch>
  );
}
