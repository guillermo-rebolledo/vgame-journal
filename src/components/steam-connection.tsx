"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button, buttonVariants } from "@/components/ui/button";

export function SteamAttribution() {
  return (
    <p className="text-xs text-muted-foreground">
      Steam data is provided “as is”, without warranties of accuracy,
      availability or fitness for a particular purpose. To the extent permitted
      by law, Valve and shelve.games are not liable for damages arising from its
      use. shelve.games is not endorsed by or affiliated with Valve.{" "}
      <a
        href="https://store.steampowered.com/"
        className="underline underline-offset-4"
      >
        Steam
      </a>{" "}
      ·{" "}
      <Link href="/privacy" className="underline underline-offset-4">
        Privacy notice
      </Link>
    </p>
  );
}

export function SteamConnection({
  connected,
  enabled,
  connectionResult,
  onDisconnect,
}: {
  connected: boolean;
  enabled: boolean;
  connectionResult?: string;
  onDisconnect: () => Promise<{ disconnected: true } | { error: string }>;
}) {
  const [linked, setLinked] = useState(connected);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    connectionResult === "failed"
      ? "Steam sign-in failed or was cancelled. Nothing was connected. Try again."
      : connectionResult === "connected"
        ? "Steam connected."
        : "",
  );
  const [pending, startTransition] = useTransition();
  const connectControl = useRef<HTMLAnchorElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (pending || !restoreFocus.current) return;
    restoreFocus.current = false;
    (enabled ? connectControl.current : heading.current)?.focus();
  }, [pending, enabled]);
  function disconnect() {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await onDisconnect();
        if ("error" in result) {
          setError(result.error);
          return;
        }
        restoreFocus.current = true;
        setLinked(false);
        setNotice("Steam disconnected. Your Journal is unchanged.");
      } catch {
        setError("Could not disconnect Steam. Please try again.");
      }
    });
  }
  return (
    <section
      aria-labelledby="steam-heading"
      className="flex min-w-0 flex-col gap-4 border-t pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          ref={heading}
          tabIndex={-1}
          id="steam-heading"
          className="font-medium outline-none"
        >
          Steam import
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect your Steam account to choose games to add as Backlog.
        </p>
      </div>
      <p className="text-sm">
        {linked ? "Steam connected" : "Steam not connected"}
      </p>
      {!enabled && (
        <p className="text-sm text-muted-foreground">
          Steam import is not available yet. You can keep adding games through
          Catalog search.
        </p>
      )}
      {!linked && enabled && (
        <a
          ref={connectControl}
          href="/api/steam/connect"
          className="inline-flex min-h-11 self-start items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Image
            src="/steam/sign-in.png"
            width={180}
            height={35}
            alt="Sign in through Steam"
          />
        </a>
      )}
      {linked && (
        <div className="flex flex-wrap gap-2">
          {enabled && (
            <Link
              href="/settings/steam"
              className={buttonVariants({ className: "min-h-11" })}
            >
              Import Steam games
            </Link>
          )}
          <Button
            variant="outline"
            className="min-h-11"
            loading={pending}
            onClick={disconnect}
          >
            Disconnect Steam
          </Button>
        </div>
      )}
      <output aria-live="polite" aria-atomic="true">
        {pending ? (
          <ActionFeedback state="pending">Disconnecting Steam…</ActionFeedback>
        ) : error ? (
          <ActionFeedback state="error">{error}</ActionFeedback>
        ) : (
          notice
        )}
      </output>
      <SteamAttribution />
    </section>
  );
}
