import { z } from 'zod';
import { supabase, hydrateSupabaseSession } from '@/lib/supabase';
import { clearSession, saveSession } from '@/lib/secure-storage';
import { useAuthStore, type AuthUser } from '@/store/auth';
import { useUserStore } from '@/store/user';
import { logEvent } from '@/lib/observability';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

async function mapUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    roles: Array.isArray(data.user.app_metadata?.roles)
      ? (data.user.app_metadata.roles as string[])
      : [],
  };
}

export async function bootstrapAuth(): Promise<void> {
  const ok = await hydrateSupabaseSession();
  if (!ok) {
    useAuthStore.getState().setSession(null);
    useAuthStore.getState().setHydrated(true);
    return;
  }
  const user = await mapUser();
  useAuthStore.getState().setSession(user);
  useAuthStore.getState().setHydrated(true);
  logEvent('auth_hydrated', { authenticated: Boolean(user) });
}

export async function login(input: z.infer<typeof loginSchema>): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? 'login_failed');
  }
  await saveSession({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : undefined,
  });
  const user = (await mapUser())!;
  useAuthStore.getState().setSession(user);
  logEvent('auth_login', { userId: user.id });
  return user;
}

export async function register(input: z.infer<typeof registerSchema>): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: { full_name: input.fullName },
    },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'register_failed');
  }
  if (data.session) {
    await saveSession({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : undefined,
    });
  }
  const user = (await mapUser()) ?? {
    id: data.user.id,
    email: data.user.email ?? null,
    roles: [],
  };
  useAuthStore.getState().setSession(data.session ? user : null);
  logEvent('auth_register', { userId: user.id });
  return user;
}

export async function forgotPassword(input: z.infer<typeof forgotPasswordSchema>): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email.trim().toLowerCase());
  if (error) throw new Error(error.message);
  logEvent('auth_forgot_password');
}

/**
 * Verifies the current password by re-authenticating (Supabase's client SDK
 * has no server-side "current_password" check like the web app's server
 * action), then updates to the new one. Never allows a passwordless change.
 */
export async function changePassword(
  input: z.infer<typeof changePasswordSchema>,
): Promise<void> {
  const email = useAuthStore.getState().user?.email;
  if (!email) throw new Error('reauth_required');

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (verifyError) throw new Error('wrong_current_password');

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) throw new Error(error.message);
  logEvent('auth_change_password');
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  await clearSession();
  useAuthStore.getState().clear();
  useUserStore.getState().clear();
  logEvent('auth_logout');
}

export async function refreshSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    await logout();
    return false;
  }
  await saveSession({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : undefined,
  });
  return true;
}
