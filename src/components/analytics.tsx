"use client";

import {
  type BeforeSendEvent,
  Analytics as VercelAnalytics,
} from "@vercel/analytics/next";

// Password reset links carry a one-time token in the query string; keep it out of analytics.
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  if (!url.searchParams.has("token")) return event;
  url.searchParams.delete("token");
  return { ...event, url: url.toString() };
}

export function Analytics() {
  return <VercelAnalytics beforeSend={redactAnalyticsEvent} />;
}
