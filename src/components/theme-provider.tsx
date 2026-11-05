"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";

function ThemeColor() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Match the header's Paper / Shelf Black background, including explicit overrides.
  return (
    <meta
      name="theme-color"
      content={mounted && resolvedTheme === "light" ? "#ffffff" : "#0a0a0a"}
    />
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColor />
      {children}
    </NextThemesProvider>
  );
}
