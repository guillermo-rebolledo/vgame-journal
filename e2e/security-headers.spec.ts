import { expect, test } from "@playwright/test";

test("documents, auth, Calendar feeds and static assets carry browser protections", async ({
  request,
}) => {
  for (const path of [
    "/sign-in",
    "/api/auth/get-session",
    "/api/calendar/synthetic-invalid-token",
    "/ratings/esrb-e.svg",
  ]) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"], path).toBe("no-referrer");
    expect(headers["permissions-policy"], path).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(headers["strict-transport-security"], path).toBe("max-age=31536000");
    expect(headers["content-security-policy"], path).toBeUndefined();
    const policy = headers["content-security-policy-report-only"];
    expect(policy, path).toContain("default-src 'self'");
    expect(policy, path).toContain("object-src 'none'");
    expect(policy, path).toContain("https://images.igdb.com");
    expect(policy, path).toContain("https://va.vercel-scripts.com");
    expect(policy, path).not.toMatch(/report-uri|report-to|report-sample/);
    expect(headers["reporting-endpoints"], path).toBeUndefined();
  }
});
