"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { captureBrowserError } from "@/lib/browser-errors";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureBrowserError(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-8">
          <h1 className="font-semibold text-3xl">Something went wrong</h1>
          <p>Your Journal is safe. Try loading this page again.</p>
          <Button onClick={reset} className="min-h-11">
            Retry page
          </Button>
        </main>
      </body>
    </html>
  );
}
