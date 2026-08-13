/**
 * Canonical telemetry surface (Sprint 9.5 Phase 6).
 * Logging / metrics / tracing / feature telemetry — single entry point.
 * Implementation delegates to observability/logger; no duplicate wrappers.
 */

import { logger } from "@/lib/observability/logger";

export type TelemetryMeta = Record<string, unknown>;

export const telemetry = {
  debug: (scope: string, message: string, meta?: TelemetryMeta) =>
    logger.debug(scope, message, meta),
  info: (scope: string, message: string, meta?: TelemetryMeta) =>
    logger.info(scope, message, meta),
  warn: (scope: string, message: string, meta?: TelemetryMeta) =>
    logger.warn(scope, message, meta),
  error: (scope: string, message: string, meta?: TelemetryMeta) =>
    logger.error(scope, message, meta),

  /** Feature-flag / gate decision breadcrumbs (docs/CI friendly). */
  feature: (
    flag: string,
    enabled: boolean,
    meta?: TelemetryMeta,
  ) => {
    logger.debug("telemetry.feature", flag, { enabled, ...meta });
  },

  /** Lightweight counter placeholder — structured log until a metrics backend exists. */
  metric: (
    name: string,
    value: number,
    meta?: TelemetryMeta,
  ) => {
    logger.info("telemetry.metric", name, { value, ...meta });
  },

  /** Span placeholder — structured log until a tracer exists. */
  trace: (
    name: string,
    meta?: TelemetryMeta,
  ) => {
    logger.debug("telemetry.trace", name, meta);
  },
};

export { logger } from "@/lib/observability/logger";
