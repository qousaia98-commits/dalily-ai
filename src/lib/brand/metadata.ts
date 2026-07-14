import type { Metadata } from "next";
import { BRAND } from "@/lib/brand/tokens";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "32x32" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_SY" : "en_US",
      siteName: BRAND.name,
      title,
      description,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: BRAND.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    appleWebApp: {
      capable: true,
      title: BRAND.name,
      statusBarStyle: "black-translucent",
    },
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: BRAND.colors.white },
      { media: "(prefers-color-scheme: dark)", color: BRAND.colors.navy },
    ],
  };
}
