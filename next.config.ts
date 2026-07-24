import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Fallback only — receipt uploads go direct to Supabase Storage.
  // Keep a modest limit so other actions cannot silently accept huge bodies.
  experimental: {
    cpus: 1,
    serverActions: {
      // Verification docs: client compresses to ~1.5MB; allow headroom for FormData.
      bodySizeLimit: "6mb",
    },
  },
  // Duplicate lint/tsc workers during `next build` OOM on some Windows hosts.
  // Quality gate remains: `npm run lint` + `npm run typecheck` (both pass).
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
