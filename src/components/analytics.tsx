"use client";

import {
  type BeforeSendEvent,
  Analytics as VercelAnalytics,
} from "@vercel/analytics/next";

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

export function Analytics() {
  return <VercelAnalytics beforeSend={redactAnalyticsEvent} />;
}
