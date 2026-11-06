import { cn } from "cn";
import { Star } from "lucide-react";
import { toStars } from "@/lib/rating";

const stars = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/** A read-only Rating as five stars: `points` 1–10 is half a star to 5 stars. Screen readers get "Rated 4.5 out of 5". */
export function RatingStars({
  points,
  className,
}: {
  points: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="sr-only">
        Rated {stars.format(toStars(points))} out of 5
      </span>
      {[0, 1, 2, 3, 4].map((i) => {
        // How much of this star is filled, 0–100%.
        const fill = Math.min(1, Math.max(0, toStars(points) - i)) * 100;
        return (
          <span key={i} aria-hidden="true" className="relative size-[1em]">
            <Star className="absolute inset-0 size-full text-muted-foreground" />
            <Star
              className="absolute inset-0 size-full fill-current"
              style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
            />
          </span>
        );
      })}
    </span>
  );
}
