import type { AppRole } from "@/types/database.types";

export const ROLES = {
  USER: "user",
  BUSINESS: "business",
  ADMIN: "admin",
  MODERATOR: "moderator",
} as const satisfies Record<string, AppRole>;

export const PROTECTED_ROUTES = {
  business: ["/business"],
  admin: ["/admin"],
  auth: ["/dashboard", "/favorites", "/reviews", "/settings"],
} as const;

export const AUTH_ROUTES = ["/login", "/register", "/register/business"] as const;

export function hasRole(roles: AppRole[], required: AppRole): boolean {
  return roles.includes(required);
}

export function hasAnyRole(roles: AppRole[], required: AppRole[]): boolean {
  return required.some((role) => roles.includes(role));
}

export function isBusinessUser(roles: AppRole[]): boolean {
  return hasAnyRole(roles, [ROLES.BUSINESS, ROLES.ADMIN]);
}

export function isAdminUser(roles: AppRole[]): boolean {
  return hasAnyRole(roles, [ROLES.ADMIN, ROLES.MODERATOR]);
}

/** Platform admin panel — admin role only (Sprint 6) */
export function isPlatformAdmin(roles: AppRole[]): boolean {
  return hasRole(roles, ROLES.ADMIN);
}

export function getPostLoginPath(roles: AppRole[]): string {
  if (isPlatformAdmin(roles)) return "/admin";
  if (isBusinessUser(roles)) return "/business";
  return "/";
}
