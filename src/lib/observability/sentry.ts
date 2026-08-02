/**
 * Shared Sentry helpers — safe no-op when SENTRY_DSN is unset
 * (same philosophy as src/lib/email/dalily-email.ts + RESEND_API_KEY).
 */

import type { ErrorEvent } from "@sentry/nextjs";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g;

/** Resolve DSN from server or public env (DSN is a write-only public key). */
export function getSentryDsn(): string | undefined {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    "";
  return dsn.length > 0 ? dsn : undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn());
}

function scrubString(value: string): string {
  return value.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
}

function scrubUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("password") ||
        lower.includes("token") ||
        lower.includes("authorization") ||
        lower.includes("cookie") ||
        lower === "email" ||
        lower === "phone" ||
        lower.includes("phone") ||
        lower === "body" ||
        lower === "requestbody" ||
        lower === "reqbody"
      ) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = scrubUnknown(nested, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Drop / scrub PII before events leave the process.
 * No request bodies, emails, or phone numbers by default.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    if (event.request.query_string) {
      event.request.query_string = "[redacted]";
    }
    if (typeof event.request.url === "string") {
      event.request.url = scrubString(event.request.url);
    }
  }

  if (event.user) {
    event.user = {
      id: event.user.id,
      // never send email/ip/username by default
    };
  }

  if (event.message) {
    event.message = scrubString(event.message);
  }

  if (event.extra) {
    event.extra = scrubUnknown(event.extra) as Record<string, unknown>;
  }

  if (event.contexts) {
    event.contexts = scrubUnknown(event.contexts) as typeof event.contexts;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubString(crumb.message) : crumb.message,
      data: crumb.data
        ? (scrubUnknown(crumb.data) as Record<string, unknown>)
        : crumb.data,
    }));
  }

  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (value.value) value.value = scrubString(value.value);
    }
  }

  return event;
}

/** Common init options for client / server / edge. */
export function buildSentryInitOptions() {
  const dsn = getSentryDsn();
  return {
    dsn,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  } as const;
}
