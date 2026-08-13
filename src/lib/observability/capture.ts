/**
 * Safe Sentry capture helpers — never throw; no-op without DSN.
 */

import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/observability/sentry";

export function captureException(
  error: unknown,
  context?: {
    scope?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): void {
  if (!isSentryEnabled()) return;

  try {
    Sentry.withScope((sentryScope) => {
      if (context?.scope) {
        sentryScope.setTag("dalily.scope", context.scope);
      }
      if (context?.tags) {
        for (const [key, value] of Object.entries(context.tags)) {
          sentryScope.setTag(key, value);
        }
      }
      if (context?.extra) {
        for (const [key, value] of Object.entries(context.extra)) {
          // Avoid dumping raw request bodies / PII — callers should pass safe fields only.
          sentryScope.setExtra(key, value);
        }
      }
      Sentry.captureException(error);
    });
  } catch {
    // Never let monitoring break the app
  }
}
