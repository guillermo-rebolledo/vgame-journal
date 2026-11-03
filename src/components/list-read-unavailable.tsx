"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ListReadUnavailable() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="alert" className="col-span-full flex flex-col gap-3">
      <p>Lists are unavailable. Your saved lists could not be loaded.</p>
      <Button
        variant="outline"
        className="min-h-11 self-start"
        disabled={pending}
        onClick={() => start(() => router.refresh())}
      >
        {pending ? "Loading…" : "Try again"}
      </Button>
    </div>
  );
}
