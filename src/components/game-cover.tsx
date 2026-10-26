"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
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
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const classes = `aspect-[264/374] shrink-0 object-cover ${className}`;
  return imageId && failedImage !== imageId ? (
    // biome-ignore lint/performance/noImgElement: IGDB CDN serves sized covers; no Next image optimization.
    <img
      src={coverUrl(imageId, size)}
      alt=""
      width={264}
      height={374}
      loading="lazy"
      onError={() => setFailedImage(imageId)}
      className={classes}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`${classes} flex flex-col items-center justify-center gap-3 border border-border/60 bg-muted text-muted-foreground`}
    >
      <ImageOff className="h-auto w-2/5 max-w-8" strokeWidth={1.5} />
      {!size && <span className="text-xs">No cover art</span>}
    </div>
  );
}
