import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Closed beta: keep the product out of search indexes until public launch. */
const CLOSED_BETA = process.env.DALILY_CLOSED_BETA !== "false";

export default function robots(): MetadataRoute.Robots {
  if (CLOSED_BETA) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/business/", "/auth/"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
