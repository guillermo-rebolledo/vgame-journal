"use client";

import { track } from "@vercel/analytics";
import {
  type BeforeSendEvent,
  Analytics as VercelAnalytics,
} from "@vercel/analytics/next";
import { type ReactNode, useEffect } from "react";
import type { CompletionTag, Status } from "@/lib/library";

// Allowlist, not denylist: free text (search), tokens, returnTo and any future param stay out by default.
const SAFE_PARAMS = new Set([
  "status",
  "platform",
  "year",
  "sort",
  "view",
  "all",
]);
const isSafeParam = (key: string) =>
  SAFE_PARAMS.has(key) || /^[a-zA-Z]+Page$/.test(key) || key.startsWith("utm_");

/** Strip anything that could identify a person from the URL Vercel Analytics records. */
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  for (const key of [...url.searchParams.keys()])
    if (!isSafeParam(key)) url.searchParams.delete(key);
  url.hash = "";
  url.pathname = url.pathname.replace(/^\/u\/[^/]+/, "/u/[username]");
  return { ...event, url: url.toString() };
}

const GOOGLE_AUTH_PARAM = "auth";

/** Where Google sends the user back to; `newUser` marks a sign-up, which reaches it after onboarding. */
export function googleCallbackURL(returnTo: string, newUser: boolean) {
  const url = new URL(returnTo, "https://callback.invalid");
  url.searchParams.set(GOOGLE_AUTH_PARAM, newUser ? "google-new" : "google");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function Analytics() {
  // A Google sign-in only succeeds off-page, so count it when the user lands back with the marker, then drop it.
  // Google returns are full page loads, so checking on mount is enough; new users land on onboarding first,
  // with the marker inside its returnTo. No usePathname: it would need a Suspense boundary in the root layout.
  useEffect(() => {
    const url = new URL(window.location.href);
    const returnTo = url.searchParams.get("returnTo");
    const inner = returnTo ? new URL(returnTo, url.origin) : null;
    const marker =
      url.searchParams.get(GOOGLE_AUTH_PARAM) ??
      inner?.searchParams.get(GOOGLE_AUTH_PARAM);
    if (marker !== "google" && marker !== "google-new") return;
    trackEvent(
      marker === "google-new" ? "sign_up_completed" : "sign_in_completed",
      { method: "google" },
    );
    url.searchParams.delete(GOOGLE_AUTH_PARAM);
    if (inner?.searchParams.has(GOOGLE_AUTH_PARAM)) {
      inner.searchParams.delete(GOOGLE_AUTH_PARAM);
      url.searchParams.set(
        "returnTo",
        `${inner.pathname}${inner.search}${inner.hash}`,
      );
    }
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);
  return <VercelAnalytics beforeSend={redactAnalyticsEvent} />;
}

/** Records `event` on any click inside; lets server components count links and submits they can't attach handlers to. */
export function TrackClicks({
  event,
  children,
}: {
  event: ProductEvent;
  children: ReactNode;
}) {
  return (
    <span className="contents" onClickCapture={() => trackEvent(...event)}>
      {children}
    </span>
  );
}

// Vercel Pro allows 2 properties per event. Values are enums, booleans or buckets only: never free text or ids.
type ProductEvents = {
  sign_up_completed: { method: "email" | "google" };
  sign_in_completed: { method: "email" | "google" };
  onboarding_completed: undefined;
  password_reset_completed: undefined;
  game_searched: { results: ResultsBucket; filtered: boolean };
  search_result_opened: { position: PositionBucket };
  home_shelf_opened: { shelf: "recent_releases" | "popular" };
  more_like_this_opened: undefined;
  journal_status_set: { status: Status; change: "added" | "changed" };
  completion_tag_set: { tag: CompletionTag };
  journal_entry_removed: { had_playthroughs: boolean };
  playthrough_added: { has_notes: boolean; has_hours: boolean };
  playthrough_removed: undefined;
  wishlist_moved: { to: Status };
  link_copied: { target: "profile" | "calendar" };
  calendar_feed_subscribed: undefined;
  calendar_feed_regenerated: undefined;
  account_data_exported: undefined;
  account_deleted: undefined;
};

/** An event name with its properties, if it has any; serializable, so server components can hand one to a client link. */
export type ProductEvent = {
  [K in keyof ProductEvents]: ProductEvents[K] extends undefined
    ? [name: K]
    : [name: K, properties: ProductEvents[K]];
}[keyof ProductEvents];

/** Fire-and-forget: never throws, never awaited, never gates what the user is doing. */
export function trackEvent(...[name, properties]: ProductEvent) {
  try {
    track(name, properties);
  } catch {}
}

type ResultsBucket = "0" | "1-9" | "10+";
export const resultsBucket = (count: number): ResultsBucket =>
  count === 0 ? "0" : count < 10 ? "1-9" : "10+";

type PositionBucket = "1-3" | "4-10" | "11+";
/** `position` is 1-based. */
export const positionBucket = (position: number): PositionBucket =>
  position <= 3 ? "1-3" : position <= 10 ? "4-10" : "11+";
