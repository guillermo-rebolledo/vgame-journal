"use client";

import { useActionState, useState } from "react";
import { trackEvent } from "@/components/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountForm({
  onDelete,
}: {
  onDelete: (form: FormData) => Promise<{ error: string }>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState(
    (_: unknown, form: FormData) => {
      // The session ends with the account, so count the confirmed request up front.
      trackEvent("account_deleted");
      return onDelete(form);
    },
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-destructive">Delete account</h2>
        <p id="delete-account-hint" className="text-muted-foreground text-sm">
          Permanently delete your account, journal, status history, and all
          playthroughs and notes. This cannot be undone. Download your journal
          first if you want to keep a copy.
        </p>
      </div>
      <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
      <Input
        id="delete-confirmation"
        name="confirmation"
        aria-describedby="delete-account-hint"
        autoComplete="off"
        spellCheck={false}
        required
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        variant="destructive"
        className="self-start"
        disabled={pending || confirmation !== "DELETE"}
      >
        {pending ? "Deleting account…" : "Permanently delete account"}
      </Button>
    </form>
  );
}
