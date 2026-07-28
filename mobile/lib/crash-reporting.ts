/**
 * Production crash reporting — Sentry-ready with local buffer fallback.
 * Wire @sentry/react-native when EXPO_PUBLIC_SENTRY_DSN is set in EAS secrets.
 */

import { env, featureFlags } from '@/constants/env';
import Constants from 'expo-constants';

type Breadcrumb = {
  category: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
};

const breadcrumbs: Breadcrumb[] = [];
let initialized = false;

export type SentryAdapter = {
  init: (dsn: string) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, context?: Record<string, unknown>) => void;
  addBreadcrumb: (crumb: Breadcrumb) => void;
  setRelease: (release: string) => void;
  setUser: (user: { id?: string; email?: string } | null) => void;
};

/** Pluggable adapter — replaced by real Sentry SDK in production builds. */
let adapter: SentryAdapter = {
  init: () => undefined,
  captureException: (error, context) => {
    if (env.isDev) console.error('[sentry:exception]', error, context);
  },
  captureMessage: (message, context) => {
    if (env.isDev) console.warn('[sentry:message]', message, context);
  },
  addBreadcrumb: (crumb) => {
    breadcrumbs.push(crumb);
    if (breadcrumbs.length > 80) breadcrumbs.shift();
  },
  setRelease: () => undefined,
  setUser: () => undefined,
};

export function registerSentryAdapter(next: SentryAdapter): void {
  adapter = next;
}

export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;
  if (!featureFlags.sentry || !env.sentryDsn) return;

  const release = `dalily-mobile@${Constants.expoConfig?.version ?? '1.0.0'}`;
  adapter.init(env.sentryDsn);
  adapter.setRelease(release);
  adapter.addBreadcrumb({
    category: 'lifecycle',
    message: 'crash_reporting_initialized',
    timestamp: Date.now(),
    data: { env: env.appEnv, release },
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  adapter.captureException(error, context);
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  adapter.captureMessage(message, context);
}

export function addCrashBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  adapter.addBreadcrumb({ category, message, data, timestamp: Date.now() });
}

export function setCrashUser(user: { id?: string; email?: string } | null): void {
  adapter.setUser(user);
}

export function getLocalBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

export const crashReportingPolicy = {
  symbolUpload: 'eas build + sentry-expo-upload-sourcemaps (CI)',
  performanceMonitoring: true,
  networkMonitoring: true,
  releaseTracking: true,
  sessionReplayPrep: 'Enable Sentry Session Replay after first production week',
} as const;
