/** URL positions are one-based; reject partial numbers; cap huge requests so they still clamp. */
export function parsePage(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page > 0 ? Math.min(page, Number.MAX_SAFE_INTEGER) : 1;
}
