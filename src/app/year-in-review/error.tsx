"use client";
import { Button } from "@/components/ui/button";
export default function ReviewError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <h1 className="font-semibold text-3xl">
        Your review could not be loaded
      </h1>
      <output>Your Journal is safe. Try loading the review again.</output>
      <Button onClick={reset} className="min-h-11">
        Retry review
      </Button>
    </div>
  );
}
