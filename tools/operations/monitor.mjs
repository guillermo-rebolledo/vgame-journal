/** Tools intentionally accept only an explicitly approved numeric loopback origin. */
export function approveTarget(target, approved) {
  const url = new URL(target);
  if (
    target !== approved ||
    url.origin !== target ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username ||
    url.password
  )
    throw new Error("Target must be an explicitly approved loopback origin");
  return url.origin;
}

/** Caller persists per-check state and sends only transitions to its chosen destination. */
export function observe(previous = { failures: 0, open: false }, healthy) {
  const failures = healthy ? 0 : Math.min(previous.failures + 1, 2);
  const open = !healthy && (previous.open || failures >= 2);
  const event =
    open && !previous.open
      ? "incident"
      : healthy && previous.open
        ? "recovery"
        : null;
  return { state: { failures, open }, event };
}

export function staleTasks(tasks, baselineAt, now) {
  const baseline = Date.parse(baselineAt);
  if (!Number.isFinite(baseline) || baseline > now)
    throw new Error("Invalid baseline");
  return tasks
    .filter((task) => {
      if (!task.enabled) return false;
      const success =
        task.lastSuccessAt === null ? baseline : Date.parse(task.lastSuccessAt);
      if (!Number.isFinite(success) || success > now)
        throw new Error("Invalid freshness timestamp");
      return now - success >= 30 * 60 * 60 * 1000;
    })
    .map((task) => task.key);
}

export async function probe(target, approved, path, marker, timeoutMs = 5000) {
  const origin = approveTarget(target, approved);
  if (!/^\/[a-z0-9/-]*$/i.test(path)) throw new Error("Invalid check path");
  if (typeof marker !== "string" || !marker.trim())
    throw new Error("Expected marker required");
  try {
    const response = await fetch(`${origin}${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return false;
    }
    const reader = response.body.getReader();
    let body = "";
    try {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) return body.includes(marker);
        bytes += value.byteLength;
        if (bytes > 262144) return false;
        body += decoder.decode(value, { stream: true });
      }
    } finally {
      await reader.cancel();
    }
  } catch {
    return false;
  }
}
