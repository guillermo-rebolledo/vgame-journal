"use client";

export function SkipLink() {
  return (
    // biome-ignore lint/a11y/useValidAnchor: Fragment navigation must also move keyboard focus to main.
    <a
      href="#main-content"
      className="sr-only rounded-md bg-background text-foreground outline-none focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4 focus:ring-3 focus:ring-ring"
      onClick={() => {
        const main = document.getElementById("main-content");
        if (!main) return;
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: "start" });
      }}
    >
      Skip to main content
    </a>
  );
}
