import type { ErrorEvent, StackFrame } from "@sentry/nextjs";
import { isNextRouterError } from "next/dist/client/components/is-next-router-error";
import { ExpectedError } from "./expected-error";
import { CODES, OPERATIONS } from "./operational-vocabulary";

// Safe translated errors retain an in-memory relationship without exposing provider causes to callers.
const originals = new WeakMap<object, unknown>();
export function linkMonitoringError<T extends Error>(
  translated: T,
  original: unknown,
): T {
  originals.set(translated, original);
  return translated;
}

export function expectedMonitoringError(error: unknown) {
  try {
    return error instanceof ExpectedError || isNextRouterError(error);
  } catch {
    return false;
  }
}

/** Only compiled application code locations; never navigation URLs or personal filesystem prefixes. */
function codeFile(value: string | undefined) {
  if (!value) return undefined;
  const path = value.split(/[?#]/)[0];
  if (/%|\\|\s/.test(path) || path.split("/").includes("..")) return undefined;
  if (
    /^https:\/\/(?:www\.)?shelve\.games\/_next\/static\/[a-zA-Z0-9_./-]+\.js$/.test(
      path,
    )
  )
    return path;
  const marker = path.indexOf("/.next/");
  if (
    marker >= 0 &&
    /^\.next\/(?:server|static)\/[a-zA-Z0-9_./()[\]-]+\.js$/.test(
      path.slice(marker + 1),
    )
  )
    return `app:///${path.slice(marker + 1)}`;
  if (/^(?:app:\/\/\/|\/)?_next\/static\/[a-zA-Z0-9_./-]+\.js$/.test(path))
    return path;
  return undefined;
}

function cleanFrame(frame: StackFrame): StackFrame | null {
  const filename = codeFile(frame.filename);
  if (!filename) return null;
  return {
    filename,
    ...(Number.isSafeInteger(frame.lineno) ? { lineno: frame.lineno } : {}),
    ...(Number.isSafeInteger(frame.colno) ? { colno: frame.colno } : {}),
    ...(typeof frame.in_app === "boolean" ? { in_app: frame.in_app } : {}),
    ...(frame.function &&
    /^[a-zA-Z_$][a-zA-Z0-9_$.<>-]{0,100}$/.test(frame.function)
      ? { function: frame.function }
      : {}),
    ...(frame.module && /^[a-zA-Z_$][a-zA-Z0-9_$./-]{0,100}$/.test(frame.module)
      ? { module: frame.module }
      : {}),
    ...(frame.debug_id && /^[a-f0-9-]{36}$/i.test(frame.debug_id)
      ? { debug_id: frame.debug_id }
      : {}),
  };
}

/** Rebuild from an allowlist rather than trying to redact arbitrary private writing. */
export function sanitizeErrorEvent(
  event: ErrorEvent,
  release: string,
): ErrorEvent | null {
  try {
    if (event.type) return null;
    return {
      ...(event.event_id && /^[a-f0-9]{32}$/i.test(event.event_id)
        ? { event_id: event.event_id }
        : {}),
      type: undefined,
      ...(typeof event.timestamp === "number" &&
      Number.isFinite(event.timestamp)
        ? { timestamp: event.timestamp }
        : {}),
      tags: {
        ...(OPERATIONS.some((value) => value === event.tags?.operation)
          ? { operation: event.tags?.operation }
          : {}),
        ...(CODES.some((value) => value === event.tags?.code)
          ? { code: event.tags?.code }
          : {}),
      },
      platform: event.platform === "node" ? "node" : "javascript",
      level: "error",
      environment: "production",
      release,
      exception: {
        values: [
          {
            type: "Error",
            value: "Unexpected application failure",
            stacktrace: {
              frames: (event.exception?.values?.[0]?.stacktrace?.frames ?? [])
                .map(cleanFrame)
                .filter((frame): frame is StackFrame => frame !== null),
            },
          },
        ],
      },
      ...(event.debug_meta
        ? {
            debug_meta: {
              images: event.debug_meta.images?.flatMap((image) => {
                const code_file = codeFile(image.code_file);
                return code_file &&
                  image.debug_id &&
                  /^[a-f0-9-]{36}$/i.test(image.debug_id)
                  ? [{ type: "sourcemap", code_file, debug_id: image.debug_id }]
                  : [];
              }),
            },
          }
        : {}),
    };
  } catch {
    return null;
  }
}

export function createErrorFilter(release: string) {
  const seen = new WeakSet<object>();
  return (event: ErrorEvent, hint: { originalException?: unknown }) => {
    try {
      const error = hint.originalException;
      if (expectedMonitoringError(error)) return null;
      // React's production RSC forwarding message is fixed by Next/React, unlike an arbitrary digest property.
      if (
        typeof window !== "undefined" &&
        error instanceof Error &&
        error.message ===
          "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error." &&
        "digest" in error &&
        /^\d+$/.test(String(error.digest))
      )
        return null;
      const chain: object[] = [];
      let current = error;
      while (
        current &&
        typeof current === "object" &&
        !chain.includes(current)
      ) {
        if (seen.has(current)) return null;
        chain.push(current);
        current =
          originals.get(current) ??
          ("cause" in current ? current.cause : undefined);
      }
      const clean = sanitizeErrorEvent(event, release);
      if (clean) for (const item of chain) seen.add(item);
      return clean;
    } catch {
      return null;
    }
  };
}
