"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId } from "react";
import { PlatformName } from "@/components/platform";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  useHoverDisclosure,
} from "@/components/ui/hover-card";

/** Render beside the game's link: the platform disclosure must not be nested inside it. */
export function GameIdentificationMetadata({
  title,
  year,
  platforms,
  selectedPlatform,
}: {
  title: string;
  year: number | null;
  platforms: string[];
  selectedPlatform?: string;
}) {
  const primary =
    selectedPlatform && platforms.includes(selectedPlatform)
      ? selectedPlatform
      : platforms[0];
  const remaining = platforms.filter((platform) => platform !== primary);
  const { open, container, setContainer, trigger, rootProps, triggerProps } =
    // A grid row would pop a card open on every Tab; keyboard activation opens this one.
    useHoverDisclosure({ openOnFocus: false });
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 text-muted-foreground text-sm [overflow-wrap:anywhere]">
      <p className="tabular-nums">{year ?? "Year unavailable"}</p>
      <p>
        {primary ? (
          <PlatformName platform={primary} compact />
        ) : (
          "Platform availability unknown"
        )}
      </p>
      {remaining.length > 0 && (
        // The remaining platforms float over the page, so a row's neighbours never move.
        <div ref={setContainer} className="flex min-w-0">
          <HoverCard {...rootProps}>
            <HoverCardTrigger
              {...triggerProps}
              render={<button ref={trigger} type="button" />}
              aria-label={`+${remaining.length} ${remaining.length === 1 ? "platform" : "platforms"} — More platforms for ${title}`}
              aria-controls={open ? id : undefined}
              className="-my-3 flex min-h-11 cursor-pointer items-center gap-1 rounded-md py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              +{remaining.length}{" "}
              {remaining.length === 1 ? "platform" : "platforms"}
              <ChevronDownIcon aria-hidden className="size-3 shrink-0" />
            </HoverCardTrigger>
            <HoverCardContent
              container={container}
              id={id}
              align="start"
              className="w-56 max-w-[calc(100vw-2rem)] break-words"
            >
              <ul
                aria-label={`Additional platforms for ${title}`}
                className="flex flex-col gap-2"
              >
                {remaining.map((platform) => (
                  <li key={platform} className="min-w-0 max-w-full">
                    <PlatformName platform={platform} />
                  </li>
                ))}
              </ul>
            </HoverCardContent>
          </HoverCard>
        </div>
      )}
    </div>
  );
}
