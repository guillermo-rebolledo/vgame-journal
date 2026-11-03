"use client";

import { useEffect } from "react";

/** Keep modal editors above the software keyboard and inside the visible viewport. */
export function useEditorViewport(open: boolean) {
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const viewport = window.visualViewport;
    function resize() {
      const desktop = window.matchMedia("(min-width: 48rem)").matches;
      const navbarHeight =
        document.querySelector("body > header")?.getBoundingClientRect()
          .height ?? 56;
      const availableHeight =
        viewport.height - navbarHeight - 16 - (desktop ? 24 : 0);
      const editorHeight = Math.max(
        0,
        Math.min(
          Math.max(availableHeight, viewport.height * 0.6),
          viewport.height - 16,
          desktop ? 720 : 960,
        ),
      );
      // The popup mounts in a portal, so publish sizing before its ref is available.
      const root = document.documentElement.style;
      root.setProperty("--editor-height", `${editorHeight}px`);
      root.setProperty(
        "--editor-bottom",
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    }
    const header = document.querySelector("body > header");
    const observer = new ResizeObserver(resize);
    if (header) observer.observe(header);
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      observer.disconnect();
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
      document.documentElement.style.removeProperty("--editor-height");
      document.documentElement.style.removeProperty("--editor-bottom");
    };
  }, [open]);
}
