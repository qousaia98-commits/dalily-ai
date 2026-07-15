import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const PUBLIC_PATHS = [
  "",
  "/search",
  "/privacy",
  "/terms",
  "/login",
  "/register",
  "/register/business",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${APP_URL}/${locale}${path}`,
      lastModified,
      changeFrequency: path === "" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : path === "/search" ? 0.9 : 0.6,
    })),
  );
}
