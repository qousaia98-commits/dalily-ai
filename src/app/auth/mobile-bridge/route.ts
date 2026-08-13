import { NextResponse } from "next/server";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  consumeMobileBridgeCode,
  sanitizeMobileBridgeTarget,
} from "@/lib/auth/mobile-bridge";
import { defaultLocale } from "@/lib/i18n/config";
import {
  localeFromPathname,
  withLocalePrefix,
} from "@/lib/auth/safe-redirect";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

/**
 * GET /auth/mobile-bridge?code=...&target=/request/new
 * Exchanges a one-time opaque code for SSR session cookies, then redirects.
 * Invalid/expired/used codes → /login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code")?.trim() ?? "";
  const targetRaw = searchParams.get("target");
  const locale = localeFromPathname(targetRaw ?? "") || defaultLocale;
  const loginPath = withLocalePrefix("/login", locale);

  const target = sanitizeMobileBridgeTarget(targetRaw);
  if (!code || !target) {
    return NextResponse.redirect(new URL(loginPath, origin));
  }

  const claimed = await consumeMobileBridgeCode(code);
  if (!claimed) {
    return NextResponse.redirect(new URL(loginPath, origin));
  }

  const redirectPath = withLocalePrefix(target, locale);
  const response = NextResponse.redirect(new URL(redirectPath, origin));

  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  const setAll: SetAllCookies = (cookiesToSet) => {
    cookiesToSet.forEach(({ name, value, options }) => {
      try {
        cookieStore.set(name, value, options);
      } catch {
        /* ignore — response cookies below are authoritative for redirect */
      }
      response.cookies.set(name, value, options);
    });
  };

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll,
    },
  });

  const { error } = await supabase.auth.setSession({
    access_token: claimed.accessToken,
    refresh_token: claimed.refreshToken,
  });

  if (error) {
    return NextResponse.redirect(new URL(loginPath, origin));
  }

  return response;
}
