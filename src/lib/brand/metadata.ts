/**
 * Site-wide metadata helpers (title, description, Open Graph, Twitter cards).
 *
 * Social image: `/og-image.png` (1200×630) — add a real PNG at public/og-image.png
 * before public launch. Until then, `/og-image.svg` may be used as a temporary stand-in.
 */
import type { Metadata, Viewport } from "next";
import { BRAND } from "@/lib/brand/tokens";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const CLOSED_BETA = process.env.DALILY_CLOSED_BETA !== "false";

/** Canonical social share image path (replace with a real 1200×630 PNG before launch). */
export const OG_IMAGE_PATH = "/og-image.png";

export function buildSiteViewport(): Viewport {
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: BRAND.colors.surface },
      { media: "(prefers-color-scheme: dark)", color: BRAND.colors.navy },
    ],
  };
}

export function buildSiteMetadata(params: {
  title: string;
  description: string;
  locale?: string;
}): Metadata {
  const { title, description, locale = "ar" } = params;

  return {
    title,
    description,
    applicationName: BRAND.name,
    metadataBase: new URL(APP_URL),
    robots: CLOSED_BETA
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/icon-light.svg", type: "image/svg+xml" }],
    },
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_SY" : "en_US",
      siteName: BRAND.name,
      title,
      description,
      url: APP_URL,
      images: [
        {
          url: OG_IMAGE_PATH,
          width: 1200,
          height: 630,
          alt: BRAND.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
    appleWebApp: {
      capable: true,
      title: BRAND.name,
      statusBarStyle: "black-translucent",
    },
  };
}
