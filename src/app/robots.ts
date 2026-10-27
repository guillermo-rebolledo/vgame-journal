import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

/** Everything behind a sign-in, plus the API. Search and AI crawlers get the rest. */
const PRIVATE = [
  "/api/",
  "/library",
  "/wishlist",
  "/stats",
  "/settings",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
