/**
 * RC2.1 P0 — Cron endpoint authentication (fail-closed).
 * Never execute cron work without a configured, valid CRON_SECRET.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";

export type CronAuthFailure =
  | { ok: false; status: 500; error: "cron_secret_missing" }
  | { ok: false; status: 401; error: "unauthorized" };

export type CronAuthSuccess = { ok: true };

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Still compare to reduce trivial timing oracle on length; pad shorter side.
    const max = Math.max(aBuf.length, bBuf.length);
    const aPad = Buffer.alloc(max);
    const bPad = Buffer.alloc(max);
    aBuf.copy(aPad);
    bBuf.copy(bPad);
    timingSafeEqual(aPad, bPad);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Validates Authorization: Bearer <CRON_SECRET>.
 * Fail-closed: missing env → 500 (misconfiguration). Bad/missing token → 401.
 */
export function assertCronAuthorized(
  request: Request,
): CronAuthSuccess | CronAuthFailure {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim().length === 0) {
    logger.error("cron_auth", "cron_secret_missing", {
      path: new URL(request.url).pathname,
      event: "security_misconfiguration",
    });
    return { ok: false, status: 500, error: "cron_secret_missing" };
  }

  const auth = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) {
    logger.warn("cron_auth", "unauthorized_cron", {
      path: new URL(request.url).pathname,
      reason: "missing_bearer",
    });
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const token = auth.slice(prefix.length);
  if (!safeEqualString(token, secret)) {
    logger.warn("cron_auth", "unauthorized_cron", {
      path: new URL(request.url).pathname,
      reason: "token_mismatch",
    });
    return { ok: false, status: 401, error: "unauthorized" };
  }

  return { ok: true };
}

export function cronUnauthorizedResponse(
  failure: CronAuthFailure,
): NextResponse {
  return NextResponse.json(
    { error: failure.error },
    { status: failure.status },
  );
}
