"use client";

import { cn } from "cn";
import { type ComponentProps, type CSSProperties, useState } from "react";
import { Button } from "@/components/ui/button";

// The theme is grayscale; a celebration gets its own colors.
const COLORS = [
  "bg-amber-400",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-rose-400",
  "bg-violet-400",
];
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  angle: `${(i * 360) / 20 + (i % 2 ? 7 : -7)}deg`,
  distance: ["-3.5rem", "-4.75rem", "-4rem"][i % 3],
  // Dots and confetti strips.
  shape: i % 2 ? "size-2 rounded-full" : "h-3 w-1.5 rounded-xs",
  color: COLORS[i % COLORS.length],
}));

/** A toggle Button that sets off a burst of confetti when switched on (not when switched off). Nothing under reduced motion. */
export function BurstButton({
  onClick,
  children,
  className,
  ...props
}: ComponentProps<typeof Button>) {
  // Each press remounts the burst so it plays again.
  const [bursts, setBursts] = useState(0);
  return (
    <Button
      {...props}
      className={cn("relative z-10", className)}
      onClick={(event) => {
        if (!props["aria-pressed"]) setBursts((n) => n + 1);
        onClick?.(event);
      }}
    >
      {children}
      {bursts > 0 && (
        <span
          key={bursts}
          data-burst
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 motion-reduce:hidden"
        >
          {PARTICLES.map((p) => (
            <span
              key={p.angle}
              className={`-translate-1/2 absolute animate-burst ${p.shape} ${p.color}`}
              style={
                {
                  "--angle": p.angle,
                  "--distance": p.distance,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
    </Button>
  );
}
