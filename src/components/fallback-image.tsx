"use client";

import { type ComponentProps, type ReactNode, useState } from "react";

/** A failed source stays hidden; a different source gets its own load attempt. */
export function FallbackImage({
  src,
  fallback = null,
  alt,
  ...props
}: Omit<ComponentProps<"img">, "src" | "onError" | "ref"> & {
  src?: string | null;
  fallback?: ReactNode;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return src && src !== failedSource ? (
    // biome-ignore lint/performance/noImgElement: Sized CDN images are served directly without Next optimization.
    <img
      {...props}
      src={src}
      alt={alt}
      ref={(image) => {
        // A server-rendered image can fail before hydration attaches onError.
        if (image?.complete && image.naturalWidth === 0) setFailedSource(src);
      }}
      onError={() => setFailedSource(src)}
    />
  ) : (
    fallback
  );
}
