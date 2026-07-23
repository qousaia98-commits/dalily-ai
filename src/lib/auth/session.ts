import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database.types";
import type { Locale } from "@/lib/i18n/config";

export type AuthUser = {
  id: string;
  email: string;
  roles: AppRole[];
  displayName: string | null;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) return null;

  const [rolesResult, profileResult] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null),
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
  ]);

  const roles = (rolesResult.data ?? []).map((row) => row.role as AppRole);

  return {
    id: user.id,
    email: user.email,
    roles,
    displayName: profileResult.data?.display_name ?? null,
  };
}

/**
 * For Server Components / pages: redirects to login instead of throwing 500.
 */
export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    const locale = (await getLocale()) as Locale;
    redirect({ href: "/login", locale });
    // unreachable — satisfies TypeScript
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/**
 * For Server Components / pages: redirects home if not admin or moderator.
 */
export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireAuthUser();
  const { canAccessAdminPanel } = await import("@/lib/auth/roles");
  if (!canAccessAdminPanel(user.roles)) {
    const locale = (await getLocale()) as Locale;
    redirect({ href: "/", locale });
    throw new Error("FORBIDDEN");
  }
  return user;
}
