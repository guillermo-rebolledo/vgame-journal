/** Nearest-rank percentiles require >=100 successful measurements in one cell. */
export function summarize(samples) {
  const values = samples
    .filter((sample) => sample.ok)
    .map((sample) => sample.ms)
    .sort((a, b) => a - b);
  const all = samples.map((sample) => sample.ms);
  return {
    attempts: samples.length,
    errors: samples.length - values.length,
    p50Ms:
      values.length >= 100 ? values[Math.ceil(values.length * 0.5) - 1] : null,
    p95Ms:
      values.length >= 100 ? values[Math.ceil(values.length * 0.95) - 1] : null,
    minMs: all.length ? Math.min(...all) : null,
    maxMs: all.length ? Math.max(...all) : null,
  };
}
