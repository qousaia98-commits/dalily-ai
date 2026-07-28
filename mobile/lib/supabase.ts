import { createClient } from '@supabase/supabase-js';
import { env } from '@/constants/env';
import { clearSession, loadSession, saveSession } from '@/lib/secure-storage';

const url = env.supabaseUrl || 'https://placeholder.supabase.co';
const anon = env.supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function hydrateSupabaseSession(): Promise<boolean> {
  const stored = await loadSession();
  if (!stored) return false;
  const { data, error } = await supabase.auth.setSession({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken,
  });
  if (error || !data.session) {
    await clearSession();
    return false;
  }
  await saveSession({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at
      ? data.session.expires_at * 1000
      : undefined,
  });
  return true;
}
