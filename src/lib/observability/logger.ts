/**
 * Sprint 5.5 — standardized application logging (structured, JSON-friendly).
 * Never logs secrets; scrub common sensitive keys from metadata.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE = /^(password|secret|token|authorization|api[_-]?key|service[_-]?role)/i;

function scrub(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE.test(k)) {
      out[k] = "[redacted]";
    } else if (v instanceof Error) {
      out[k] = { message: v.message, name: v.name };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function write(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...scrub(meta),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug" && process.env.NODE_ENV !== "production") {
    console.debug(line);
  } else if (level !== "debug") {
    console.info(line);
  }
}

export const logger = {
  debug: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("debug", scope, message, meta),
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("error", scope, message, meta),
};
