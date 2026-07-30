import type { AppRole } from "@/types/database.types";

export const ROLES = {
  USER: "user",
  BUSINESS: "business",
  ADMIN: "admin",
  MODERATOR: "moderator",
  /** Financial operations only — refunds, escrow, wallets, payouts. */
  FINANCE: "finance",
  /** Content / trust support — not financial (maps to moderator capabilities). */
  SUPPORT: "support",
} as const satisfies Record<string, AppRole>;

export const PROTECTED_ROUTES = {
  business: ["/business"],
  admin: ["/admin"],
  auth: ["/dashboard", "/reviews", "/settings"],
} as const;

export const AUTH_ROUTES = [
  "/login",
  "/register",
  "/register/business",
  "/forgot-password",
  "/reset-password",
] as const;

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
  return hasAnyRole(roles, [
    ROLES.ADMIN,
    ROLES.MODERATOR,
    ROLES.FINANCE,
    ROLES.SUPPORT,
  ]);
}

/** Super Admin — full platform admin (not moderators / support / finance-only). */
export function isPlatformAdmin(roles: AppRole[]): boolean {
  return hasRole(roles, ROLES.ADMIN);
}

/**
 * Finance or Super Admin — money mutations and cross-user financial reads.
 * Moderators / support must NOT pass this gate.
 */
export function canManageFinance(roles: AppRole[]): boolean {
  return hasAnyRole(roles, [ROLES.ADMIN, ROLES.FINANCE]);
}

/** Content moderation — reports, suspensions, listings, conversations. */
export function canModerateContent(roles: AppRole[]): boolean {
  return hasAnyRole(roles, [
    ROLES.ADMIN,
    ROLES.MODERATOR,
    ROLES.SUPPORT,
  ]);
}

/** Admin Control Center access — admin, finance, moderator, or support. */
export function canAccessAdminPanel(roles: AppRole[]): boolean {
  return isAdminUser(roles);
}

export function getPostLoginPath(roles: AppRole[]): string {
  if (canAccessAdminPanel(roles)) return "/admin";
  if (isBusinessUser(roles)) return "/business";
  return "/";
}
