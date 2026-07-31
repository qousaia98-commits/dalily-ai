/**
 * Mobile WebView session bridge — opaque one-time codes (never put JWTs in URLs).
 */

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import {
  sanitizeAppRedirect,
  stripLocaleFromPath,
} from "@/lib/auth/safe-redirect";
import type { Database } from "@/types/database.types";

export const MOBILE_BRIDGE_TTL_SECONDS = 60;

/** Safe in-app path prefixes for post-bridge redirects (no open redirects). */
export const MOBILE_BRIDGE_ALLOWED_PREFIXES = [
  "/request",
  "/find",
  "/providers",
  "/messages",
  "/account",
] as const;

export type MobileBridgeCodeRow = {
  id: string;
  code: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

function pathAndSearch(raw: string): { pathname: string; search: string } {
  const q = raw.indexOf("?");
  if (q === -1) return { pathname: raw, search: "" };
  return { pathname: raw.slice(0, q), search: raw.slice(q) };
}

/**
 * Validate bridge `target` against relative-path + marketplace allowlist.
 * Returns locale-stripped path (+ query) or null.
 */
export function sanitizeMobileBridgeTarget(
  raw: string | null | undefined,
): string | null {
  const sanitized = sanitizeAppRedirect(raw);
  if (!sanitized) return null;

  const { pathname, search } = pathAndSearch(sanitized);

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (
    decoded.includes("..") ||
    decoded.includes("//") ||
    decoded.includes("\\") ||
    decoded.includes("\0")
  ) {
    return null;
  }

  const clean = stripLocaleFromPath(decoded);
  const allowed = MOBILE_BRIDGE_ALLOWED_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`),
  );
  if (!allowed) return null;

  return `${clean}${search}`;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return null;
  const token = header.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

/** Validate a mobile access JWT and return the auth user id. */
export async function getUserIdFromAccessToken(
  accessToken: string,
): Promise<string | null> {
  const { url, anonKey } = requireSupabaseEnv();
  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

/** Delete expired (and aged used) bridge rows. Safe to call often. */
export async function cleanupExpiredMobileBridgeCodes(): Promise<number> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("mobile_bridge_codes")
    .delete()
    .lt("expires_at", nowIso)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }
  return data?.length ?? 0;
}

export async function issueMobileBridgeCode(input: {
  userId: string;
  accessToken: string;
  refreshToken: string;
}): Promise<{ code: string }> {
  // Best-effort cleanup on write (same pattern as other short-lived state).
  try {
    await cleanupExpiredMobileBridgeCodes();
  } catch {
    /* non-fatal */
  }

  const admin = createAdminClient();
  const code = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + MOBILE_BRIDGE_TTL_SECONDS * 1000,
  ).toISOString();

  const { error } = await admin.from("mobile_bridge_codes").insert({
    code,
    user_id: input.userId,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { code };
}

/**
 * Atomically claim a one-time code. Returns session tokens or null if invalid.
 */
export async function consumeMobileBridgeCode(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  if (!code || code.length > 128) return null;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: claimed, error } = await admin
    .from("mobile_bridge_codes")
    .update({ used_at: nowIso })
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("id, user_id, access_token, refresh_token")
    .maybeSingle();

  if (error || !claimed) return null;

  const accessToken = claimed.access_token;
  const refreshToken = claimed.refresh_token;
  const userId = claimed.user_id;

  // Defense in depth: scrub tokens after claim (row retained until expiry cleanup).
  await admin
    .from("mobile_bridge_codes")
    .update({ access_token: "used", refresh_token: "used" })
    .eq("id", claimed.id);

  return { accessToken, refreshToken, userId };
}
