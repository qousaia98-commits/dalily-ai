import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ROUTES, getPostLoginPath, isBusinessUser } from "@/lib/auth/roles";
import type { AppRole } from "@/types/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/app-client";
function stripLocalePrefix(pathname: string): string {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const stripped = pathname.slice(3);
    return stripped.length > 0 ? stripped : "/";
  }
  return pathname;
}

function isAuthRoute(path: string): boolean {
  return AUTH_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

function isBusinessRoute(path: string): boolean {
  return path === "/business" || path.startsWith("/business/");
}

function isAdminRoute(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function localePrefix(pathname: string): string {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "/en";
  return "";
}

export async function enforceRouteAuth(
  request: NextRequest,
  response: NextResponse,
  supabase: AppSupabaseClient,
): Promise<NextResponse> {  const pathname = stripLocalePrefix(request.nextUrl.pathname);
  const prefix = localePrefix(request.nextUrl.pathname);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isBusinessRoute(pathname) || isAdminRoute(pathname)) {
      const loginUrl = new URL(`${prefix}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  const roles = (roleRows ?? []).map((row) => row.role as AppRole);

  if (isAuthRoute(pathname)) {
    const destination = getPostLoginPath(roles);
    return NextResponse.redirect(new URL(`${prefix}${destination}`, request.url));
  }

  if (isBusinessRoute(pathname) && !isBusinessUser(roles)) {
    return NextResponse.redirect(new URL(`${prefix}/register/business`, request.url));
  }

  if (isAdminRoute(pathname) && !roles.includes("admin") && !roles.includes("moderator")) {
    return NextResponse.redirect(new URL(`${prefix}/`, request.url));
  }

  return response;
}
