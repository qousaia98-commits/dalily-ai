import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing-config";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);

  // Auth redirects (login, role gates) must win over intl rewrite.
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    return supabaseResponse;
  }

  const intlResponse = intlMiddleware(request);

  // Merge Supabase session cookies into the intl response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    // /auth/* are root-level, unprefixed route handlers (OAuth callback,
    // mobile session bridge) that manage their own Supabase session and
    // redirect — the next-intl locale rewrite has no matching [locale]
    // page for them and 404s if it's allowed to intercept.
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
