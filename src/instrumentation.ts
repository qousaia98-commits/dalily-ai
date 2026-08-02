/**
 * Next.js instrumentation — registers Sentry for Node and Edge runtimes.
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Capture errors from Server Components, middleware, and proxies (Next.js 15+). */
export const onRequestError = Sentry.captureRequestError;
