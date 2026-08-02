/**
 * Edge runtime Sentry init (middleware / edge routes).
 * No-op when SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/nextjs";
import { buildSentryInitOptions } from "@/lib/observability/sentry";

Sentry.init({
  ...buildSentryInitOptions(),
});
