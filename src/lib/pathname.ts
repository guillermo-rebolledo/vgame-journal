/** Shared by feedback and telemetry: route context must never contain credentials or private identifiers. */
export function redactPathname(path: string): string {
  return path
    .replace(/^\/u\/[^/]+/i, "/u/[username]")
    .replace(/^(\/(?:u\/\[username\]\/)?lists)\/[^/]+/i, "$1/[listId]")
    .replace(
      /^(\/api\/auth\/(?:reset-password|verify-email))\/[^/]+.*$/i,
      "$1/[token]",
    )
    .replace(/^(\/(?:api\/)?calendar)\/[^/]+.*$/i, "$1/[token]");
}
