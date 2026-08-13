/**
 * Browser Sentry init (App Router client instrumentation).
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 * No-op when NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/nextjs";
import { buildSentryInitOptions } from "@/lib/observability/sentry";

Sentry.init({
  ...buildSentryInitOptions(),
});

// Router navigation instrumentation (required by @sentry/nextjs App Router setup).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
