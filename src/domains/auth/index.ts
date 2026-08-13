/**
 * SAD Auth domain facade (Sprint 0).
 * Behavior unchanged — selective re-exports from existing lib.
 * @see docs/architecture/sad-boundaries.md
 */

export const AUTH_DOMAIN = {
  service: "auth",
  owns: ["identity", "sessions", "role_bindings"],
  impl: ["src/lib/auth"],
  status: "facade",
} as const;

export {
  ROLES,
  PROTECTED_ROUTES,
  AUTH_ROUTES,
  hasRole,
  hasAnyRole,
  isBusinessUser,
  isAdminUser,
  isPlatformAdmin,
  canAccessAdminPanel,
} from "@/lib/auth/roles";
