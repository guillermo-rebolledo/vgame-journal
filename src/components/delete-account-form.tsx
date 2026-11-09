"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountForm({
  onDelete,
  onVerify,
  onCancel,
  onSendCode,
  verified,
  hasPassword,
  hasGoogle,
}: {
  onDelete: (form: FormData) => Promise<{ error: string }>;
  onVerify: (form: FormData) => Promise<{ error?: string; verified?: true }>;
  onCancel: () => Promise<object>;
  onSendCode: () => Promise<{ sent?: true; error?: string }>;
  verified: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
}) {
  const confirmationInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const wasVerified = useRef(verified);
  useEffect(() => {
    if (verified !== wasVerified.current) {
      (verified
        ? confirmationInput
        : hasPassword
          ? passwordInput
          : sendButton
      ).current?.focus();
      setConfirmation("");
      wasVerified.current = verified;
    }
  }, [verified, hasPassword]);
  const [confirmation, setConfirmation] = useState("");
  const [deletionError, setDeletionError] = useState("");
  const [verifyState, verifyAction, verifying] = useActionState(
    (_: unknown, form: FormData) => {
      setDeletionError("");
      return onVerify(form);
    },
    undefined,
  );
  const [actionError, setActionError] = useState("");
  const [sent, setSent] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const [sendState, sendAction, sending] = useActionState(async () => {
    const result = await onSendCode();
    if (result.sent) setSent(true);
    return result;
  }, undefined);
  useEffect(() => {
    if (sent) codeInput.current?.focus();
  }, [sent]);
  const [cancelling, setCancelling] = useState(false);
  const [, action, pending] = useActionState(
    async (_: unknown, form: FormData) => {
      const result = await onDelete(form);
      setDeletionError(result.error);
      return result;
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
      {verified && actionError && (
        <p role="alert" className="text-destructive text-sm">
          {actionError}
        </p>
      )}
      {deletionError && (
        <p role="alert" className="text-destructive text-sm">
          {deletionError}
        </p>
      )}
      <output
        aria-live="polite"
        aria-atomic="true"
        className="text-muted-foreground text-sm"
      >
        {pending
          ? "Deleting account…"
          : cancelling
            ? "Cancelling deletion…"
            : verifying
              ? "Confirming identity…"
              : sending
                ? "Sending confirmation code…"
                : verified
                  ? "Identity confirmed."
                  : sent
                    ? "Confirmation code sent. Check your email."
                    : ""}
      </output>
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
          {!hasPassword && hasGoogle && (
            <>
              <p className="text-muted-foreground text-sm">
                Send a one-use code to your verified account email. Enter it
                here to confirm your identity.
              </p>
              <form action={sendAction}>
                <Button
                  ref={sendButton}
                  type="submit"
                  variant="outline"
                  loading={sending}
                  disabled={verifying}
                >
                  Send confirmation code
                </Button>
              </form>
              {sendState?.error && (
                <p role="alert" className="text-destructive text-sm">
                  {sendState.error}
                </p>
              )}
              {sent && (
                <form action={verifyAction} className="flex flex-col gap-3">
                  <Label htmlFor="deletion-code">Email confirmation code</Label>
                  <Input
                    ref={codeInput}
                    id="deletion-code"
                    name="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    required
                    aria-invalid={Boolean(verifyState?.error)}
                    aria-describedby={
                      verifyState?.error
                        ? "deletion-code-error"
                        : "delete-account-hint"
                    }
                  />
                  {verifyState?.error && (
                    <p
                      id="deletion-code-error"
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
                    disabled={sending}
                  >
                    Confirm email code
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    loading={cancelling}
                    disabled={verifying || sending}
                    onClick={async () => {
                      setCancelling(true);
                      try {
                        await onCancel();
                        setSent(false);
                        sendButton.current?.focus();
                      } catch {
                        setActionError(
                          "Could not cancel deletion. Please try again.",
                        );
                      } finally {
                        setCancelling(false);
                      }
                    }}
                  >
                    Cancel deletion
                  </Button>
                </form>
              )}
            </>
          )}
          {actionError && (
            <p role="alert" className="text-destructive text-sm">
              {actionError}
            </p>
          )}
        </>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <p className="text-sm">
            Identity confirmed. Type DELETE before your confirmation expires.
          </p>
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
            Permanently delete account
          </Button>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            loading={cancelling}
            disabled={pending}
            onClick={async () => {
              setDeletionError("");
              setCancelling(true);
              setConfirmation("");
              try {
                await onCancel();
                setSent(false);
              } catch {
                setActionError("Could not cancel deletion. Please try again.");
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
