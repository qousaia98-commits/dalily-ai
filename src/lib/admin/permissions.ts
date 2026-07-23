/**
 * Sprint 41 — Admin permission helpers.
 * Future Super Admin is architecture-only.
 */

import type { AppRole } from "@/types/database.types";
import { hasAnyRole, hasRole, ROLES } from "@/lib/auth/roles";

export type AdminPermission =
  | "dashboard"
  | "providers"
  | "customers"
  | "verification"
  | "issues"
  | "reviews"
  | "ranking"
  | "analytics"
  | "search_analytics"
  | "content"
  | "broadcasts"
  | "health"
  | "audit"
  | "payments"
  | "subscriptions"
  | "learning";

/** Architecture stub — not granted yet. */
export function isSuperAdmin(_roles: AppRole[]): boolean {
  void _roles;
  return false;
}

export function canAccessAdminPanel(roles: AppRole[]): boolean {
  return hasAnyRole(roles, [ROLES.ADMIN, ROLES.MODERATOR]) || isSuperAdmin(roles);
}

const MODERATOR_PERMISSIONS: AdminPermission[] = [
  "dashboard",
  "providers",
  "customers",
  "verification",
  "issues",
  "reviews",
  "ranking",
  "analytics",
  "search_analytics",
  "content",
  "health",
  "audit",
];

const ADMIN_ONLY: AdminPermission[] = [
  "payments",
  "subscriptions",
  "broadcasts",
  "learning",
];

export function hasAdminPermission(
  roles: AppRole[],
  permission: AdminPermission,
): boolean {
  if (isSuperAdmin(roles) || hasRole(roles, ROLES.ADMIN)) return true;
  if (!hasRole(roles, ROLES.MODERATOR)) return false;
  if (ADMIN_ONLY.includes(permission)) return false;
  return MODERATOR_PERMISSIONS.includes(permission);
}
