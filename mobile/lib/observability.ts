/**
 * Crash reporting bridge for observability.
 */

import { env, featureFlags, type FeatureFlagKey } from '@/constants/env';
import {
  addCrashBreadcrumb,
  captureException,
  captureMessage,
  initCrashReporting,
} from '@/lib/crash-reporting';
import { trackScreen } from '@/lib/analytics';

type MetricPayload = Record<string, unknown>;

const buffer: { type: string; at: number; payload: MetricPayload }[] = [];

export function logEvent(name: string, payload: MetricPayload = {}): void {
  buffer.push({ type: name, at: Date.now(), payload });
  if (env.isDev) {
    console.log(`[dalily:${name}]`, payload);
  }
  if (featureFlags.sentry && env.sentryDsn) {
    addCrashBreadcrumb('event', name, payload);
  }
}

export function logApiMetric(input: {
  path: string;
  method: string;
  status: number;
  latencyMs: number;
}): void {
  logEvent('api_metric', input);
  addCrashBreadcrumb('network', `${input.method} ${input.path}`, input);
}

export function logNavigation(route: string): void {
  logEvent('navigation', { route });
  trackScreen(route);
}

export function logFeatureFlag(key: FeatureFlagKey, enabled: boolean): void {
  logEvent('feature_flag', { key, enabled });
}

export function logCrash(error: unknown, context?: MetricPayload): void {
  logEvent('crash', {
    message: error instanceof Error ? error.message : String(error),
    ...context,
  });
  captureException(error, context);
}

export function bootstrapObservability(): void {
  initCrashReporting();
  captureMessage('observability_boot', { env: env.appEnv });
}

export function getObservabilityBuffer() {
  return [...buffer];
}
