"use client";

import { useEffect, useRef, useState } from "react";
import type { ListVisibility } from "@/lib/lists";

type Draft = {
  title: string;
  description: string;
  visibility: ListVisibility;
  submissionId: string;
  revision?: number;
};

/** Per-tab and per-actor: signing back into the original account can recover an interrupted form. */
export function useListDraft(actor: string, scope: string, initial: Draft) {
  const key = `custom-list-draft:${actor}:${scope}`;
  const defaults = useRef(initial);
  const [draft, setDraft] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (
        value &&
        typeof value.title === "string" &&
        value.title.length <= 100 &&
        typeof value.description === "string" &&
        value.description.length <= 2000 &&
        (value.visibility === "private" || value.visibility === "public") &&
        typeof value.submissionId === "string" &&
        (value.revision === undefined || Number.isSafeInteger(value.revision))
      )
        setDraft(value);
    } catch {
      /* Storage may be unavailable; the in-memory draft still works. */
    }
    setReady(true);
  }, [key]);
  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }
  function clear() {
    setDraft(defaults.current);
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }
  return { draft, update, clear, ready };
}
