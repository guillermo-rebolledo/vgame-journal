import type { NextConfig } from "next";
import { isIsolatedE2E } from "./src/lib/e2e-harness";

const e2e = isIsolatedE2E();

// Report-only rollout: inspect locally; remote reports can include credential-bearing document URLs.
const reportOnlyCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.igdb.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: e2e ? ".next-e2e" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  typescript: { tsconfigPath: "tsconfig.build.json" },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "no-referrer" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
      ],
    },
    // Rating logos never change; a new logo gets a new filename.
    {
      source: "/ratings/:file*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
  turbopack: {
    ...(e2e && {
      resolveAlias: {
        "@/db": "./e2e/support/db.ts",
        "@/db/batch": "./e2e/support/batch.ts",
        "@/lib/igdb": "./e2e/support/game-source.ts",
        "@/lib/flags": "./e2e/support/flags.ts",
        "@/lib/steam": "./e2e/support/steam.ts",
        "@/lib/steam-openid": "./e2e/support/steam-openid.ts",
      },
    }),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
