"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DELETION_CALLBACK } from "@/lib/account-security-constants";
import { authClient } from "@/lib/auth-client";

export function DeleteAccountForm({
  onDelete,
  onVerify,
  onCancel,
  verified,
  hasPassword,
  hasGoogle,
  notice,
}: {
  onDelete: (form: FormData) => Promise<{ error: string }>;
  onVerify: (form: FormData) => Promise<{ error?: string; verified?: true }>;
  onCancel: () => Promise<object>;
  notice?: string;
  verified: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
}) {
  const confirmationInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const wasVerified = useRef(verified);
  useEffect(() => {
    if (verified !== wasVerified.current) {
      (verified ? confirmationInput : passwordInput).current?.focus();
      setConfirmation("");
      wasVerified.current = verified;
    }
  }, [verified]);
  const [confirmation, setConfirmation] = useState("");
  const [verifyState, verifyAction, verifying] = useActionState(
    (_: unknown, form: FormData) => onVerify(form),
    undefined,
  );
  const [googleError, setGoogleError] = useState("");
  const [googlePending, setGooglePending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [state, action, pending] = useActionState(
    (_: unknown, form: FormData) => {
      return onDelete(form);
    },
    undefined,
  );

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-destructive">Delete account</h2>
        <p id="delete-account-hint" className="text-muted-foreground text-sm">
          Permanently delete your account, journal, status history, and all
          playthroughs and notes. This cannot be undone. Download your journal
          first if you want to keep a copy.
        </p>
      </div>
      {notice && (
        <p role="alert" className="text-destructive text-sm">
          {notice}
        </p>
      )}
      {verified && googleError && (
        <p role="alert" className="text-destructive text-sm">
          {googleError}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      {!verified ? (
        <>
          <p className="text-muted-foreground text-sm">
            Confirm your identity again before deleting. Confirmation lasts five
            minutes and can only be used once.
          </p>
          {hasPassword && (
            <form action={verifyAction} className="flex flex-col gap-3">
              <Label htmlFor="deletion-password">Current password</Label>
              <Input
                ref={passwordInput}
                id="deletion-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(verifyState?.error)}
                aria-describedby={
                  verifyState?.error
                    ? "deletion-password-error"
                    : "delete-account-hint"
                }
              />
              {verifyState?.error && (
                <p
                  id="deletion-password-error"
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {verifyState.error}
                </p>
              )}
              <Button
                type="submit"
                variant="outline"
                className="self-start"
                loading={verifying}
              >
                Confirm password
              </Button>
              <a
                href="/forgot-password"
                className="self-start text-sm underline underline-offset-4"
              >
                Reset password
              </a>
            </form>
          )}
          {hasGoogle && (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              loading={googlePending}
              onClick={async () => {
                setGooglePending(true);
                setGoogleError("");
                try {
                  const result = await authClient.signIn.social({
                    provider: "google",
                    callbackURL: DELETION_CALLBACK,
                    errorCallbackURL: "/settings?deletion=failed",
                  });
                  if (result.error) throw new Error();
                } catch {
                  setGoogleError(
                    "Could not confirm with Google. Your account has not been deleted. Try again.",
                  );
                  setGooglePending(false);
                }
              }}
            >
              Confirm with Google
            </Button>
          )}
          {googleError && (
            <p role="alert" className="text-destructive text-sm">
              {googleError}
            </p>
          )}
        </>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <output className="text-sm">
            Identity confirmed. Type DELETE within five minutes to continue.
          </output>
          <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
          <Input
            ref={confirmationInput}
            id="delete-confirmation"
            name="confirmation"
            aria-describedby="delete-account-hint"
            autoComplete="off"
            spellCheck={false}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <Button
            type="submit"
            variant="destructive"
            className="self-start"
            loading={pending}
            disabled={pending || cancelling || confirmation !== "DELETE"}
          >
            {pending ? "Deleting account…" : "Permanently delete account"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            loading={cancelling}
            disabled={pending}
            onClick={async () => {
              setCancelling(true);
              setConfirmation("");
              try {
                await onCancel();
              } catch {
                setGoogleError("Could not cancel deletion. Please try again.");
              } finally {
                setCancelling(false);
              }
            }}
          >
            Cancel deletion
          </Button>
        </form>
      )}
    </section>
  );
}
