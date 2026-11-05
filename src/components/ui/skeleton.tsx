import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("max-w-full rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
