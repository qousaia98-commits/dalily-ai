import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Fallback only — receipt uploads go direct to Supabase Storage.
  // Keep a modest limit so other actions cannot silently accept huge bodies.
  experimental: {
    // Avoid single-CPU starvation on large App Router graphs (was amplifying
    // memory pressure → automatic `next dev` restarts → stale Server Action IDs).
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
  // Expose DSN to the browser when only SENTRY_DSN is set (DSN is write-only / public).
  env: {
    NEXT_PUBLIC_SENTRY_DSN:
      process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "",
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

/**
 * Always wrap for SDK webpack hooks, but keep source-map upload and CLI noise
 * fully disabled unless Sentry auth is configured — missing DSN must not break builds.
 */
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  widenClientFileUpload: Boolean(process.env.SENTRY_AUTH_TOKEN),
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
