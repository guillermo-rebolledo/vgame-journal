"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { verifySentryAction } from "./actions";

export function VerificationControls() {
  const [crash, setCrash] = useState(false);
  const [result, setResult] = useState("");
  if (crash) throw new Error("Sentry verification: browser render");
  return (
    <div className="flex flex-col items-start gap-4">
      <Button onClick={() => setCrash(true)} className="min-h-11">
        Test browser render
      </Button>
      <Button
        onClick={() => {
          setTimeout(() => {
            throw new Error("Sentry verification: browser handler");
          }, 0);
        }}
        className="min-h-11"
      >
        Test browser handler
      </Button>
      <Button
        onClick={async () => {
          try {
            await verifySentryAction();
          } catch {
            setResult("Server action failure returned safely.");
          }
        }}
        className="min-h-11"
      >
        Test server action
      </Button>
      <output aria-live="polite">{result}</output>
    </div>
  );
}
