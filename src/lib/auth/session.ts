import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database.types";

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

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireAuthUser();
  const { isPlatformAdmin } = await import("@/lib/auth/roles");
  if (!isPlatformAdmin(user.roles)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
