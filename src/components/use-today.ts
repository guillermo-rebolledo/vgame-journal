"use client";

import { useSyncExternalStore } from "react";
import { localDay } from "@/lib/release-dates";

// Re-read the clock every minute so a Countdown ticks over at local midnight.
const everyMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};
const today = () =>
  localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

/** Null on the server, which doesn't know the visitor's time zone. */
export const useToday = () =>
  useSyncExternalStore(everyMinute, today, () => null);
