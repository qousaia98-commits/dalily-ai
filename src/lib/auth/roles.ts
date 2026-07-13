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

export function getPostLoginPath(roles: AppRole[]): string {
  if (isAdminUser(roles)) return "/admin";
  if (isBusinessUser(roles)) return "/business";
  return "/";
}
