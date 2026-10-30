"use client";

import { ImageOff } from "lucide-react";
import { FallbackImage } from "@/components/fallback-image";
import { coverUrl } from "@/lib/game-source";

/** Decorative: the adjacent game title supplies the link's accessible name. */
export function GameCover({
  imageId,
  size,
  className,
}: {
  imageId: string | null;
  size?: "cover_small";
  className: string;
}) {
  const classes = `aspect-[264/374] shrink-0 object-cover ${className}`;
  return (
    <FallbackImage
      src={imageId ? coverUrl(imageId, size) : null}
      alt=""
      width={264}
      height={374}
      loading="lazy"
      className={classes}
      fallback={
        <div
          aria-hidden="true"
          className={`${classes} flex flex-col items-center justify-center gap-3 border border-border/60 bg-muted text-muted-foreground`}
        >
          <ImageOff className="h-auto w-2/5 max-w-8" strokeWidth={1.5} />
          {!size && <span className="text-xs">No cover art</span>}
        </div>
      }
    />
  );
}
