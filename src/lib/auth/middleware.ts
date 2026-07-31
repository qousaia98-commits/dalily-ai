import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_ROUTES,
  canAccessAdminPanel,
  getPostLoginPath,
  isBusinessUser,
} from "@/lib/auth/roles";
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

/** Customer marketplace discovery — providers must not land here. */
function isCustomerMarketplaceRoute(path: string): boolean {
  if (path === "/" || path === "/search" || path === "/ai" || path === "/find") return true;
  if (path.startsWith("/search/") || path.startsWith("/ai/") || path.startsWith("/find/")) {
    return true;
  }
  if (path === "/request/new" || path.startsWith("/request/")) return true;
  if (path.startsWith("/providers/")) return true;
  return false;
}

function localePrefix(pathname: string): string {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "/en";
  return "";
}

export async function enforceRouteAuth(
  request: NextRequest,
  response: NextResponse,
  supabase: AppSupabaseClient,
): Promise<NextResponse> {
  const pathname = stripLocalePrefix(request.nextUrl.pathname);
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
    // Allow /reset-password for authenticated users: recovery link lands here
    // after exchangeCodeForSession, and logged-in users may change password
    // with current_password verification.
    if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) {
      return response;
    }

    const isBusinessRegistrationRoute =
      pathname === "/register/business" || pathname.startsWith("/register/business/");
    if (isBusinessRegistrationRoute && !isBusinessUser(roles)) {
      return response;
    }

    const destination = getPostLoginPath(roles);
    return NextResponse.redirect(new URL(`${prefix}${destination}`, request.url));
  }

  if (isBusinessRoute(pathname) && !isBusinessUser(roles)) {
    return NextResponse.redirect(new URL(`${prefix}/register/business`, request.url));
  }

  if (isAdminRoute(pathname) && !canAccessAdminPanel(roles)) {
    return NextResponse.redirect(new URL(`${prefix}/`, request.url));
  }

  // Role-aware home: providers never see customer marketplace discovery.
  if (
    isBusinessUser(roles) &&
    !canAccessAdminPanel(roles) &&
    isCustomerMarketplaceRoute(pathname)
  ) {
    return NextResponse.redirect(new URL(`${prefix}/business`, request.url));
  }

  return response;
}

