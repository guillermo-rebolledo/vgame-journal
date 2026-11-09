"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

export function SignOutAllForm({
  onSignOut,
}: {
  onSignOut: () => Promise<{ error: string }>;
}) {
  const [state, action, pending] = useActionState(onSignOut, undefined);
  return (
    <form action={action} className="flex flex-col gap-3 border-t pt-6">
      <h2 className="font-medium">Sign out all devices</h2>
      <p className="text-muted-foreground text-sm">
        End every signed-in session, including this device. Password resets also
        sign out every device.
      </p>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <output
        aria-live="polite"
        aria-atomic="true"
        className="text-muted-foreground text-sm"
      >
        {pending ? "Signing out all devices…" : ""}
      </output>
      <Button
        type="submit"
        variant="outline"
        className="self-start"
        loading={pending}
      >
        Sign out all devices
      </Button>
    </form>
  );
}
