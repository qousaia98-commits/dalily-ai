import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale } from "@/lib/i18n/config";
import {
  localeFromPathname,
  sanitizeAppRedirect,
  stripLocaleFromPath,
  withLocalePrefix,
} from "@/lib/auth/safe-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = sanitizeAppRedirect(searchParams.get("next")) ?? "/";
  const locale = localeFromPathname(nextRaw) || defaultLocale;
  const nextPath = withLocalePrefix(stripLocaleFromPath(nextRaw), locale);
  const loginPath = withLocalePrefix("/login", locale);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, origin));
    }
  }

  const fail = new URL(loginPath, origin);
  fail.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(fail);
}
