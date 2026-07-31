/**
 * Detect password-recovery sessions via JWT AMR claims.
 *
 * Installed stack: @supabase/supabase-js@2.110.2 → @supabase/auth-js@2.110.2.
 * Canonical API: `supabase.auth.getClaims()` returns verified JWT payload including `amr`.
 * GoTrue marks recovery-link exchanges with authentication method `"recovery"`
 * (see AuthenticationMethod.Recovery / IsRecovery in supabase/auth).
 * JWT field docs: https://supabase.com/docs/guides/auth/jwt-fields
 */

import type { JwtPayload } from "@supabase/supabase-js";

type AuthClaimsClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: JwtPayload } | null;
      error: { message: string } | null;
    }>;
  };
};

/** True if AMR includes the dedicated password-recovery method. */
export function amrIncludesRecovery(
  amr: JwtPayload["amr"] | null | undefined,
): boolean {
  if (!amr || !Array.isArray(amr)) return false;
  return amr.some((entry) => {
    if (typeof entry === "string") return entry === "recovery";
    return entry?.method === "recovery";
  });
}

/**
 * Whether the current SSR session came from a password-recovery email link
 * (forgot-password → callback → exchangeCodeForSession), not a normal login.
 */
export async function isPasswordRecoverySession(
  supabase: AuthClaimsClient,
): Promise<boolean> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return false;
  return amrIncludesRecovery(data.claims.amr);
}
