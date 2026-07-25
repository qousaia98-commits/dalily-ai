/**
 * SAD Admin domain facade (Sprint 0).
 * Economy/cell controls arrive Sprint 9 — no behavior change now.
 */

export const ADMIN_DOMAIN = {
  service: "admin",
  owns: ["admin_cases", "cell_overrides", "enforcement_actions"],
  impl: ["src/lib/admin"],
  status: "facade",
} as const;

export { logAdminAudit, type AuditAction } from "@/lib/admin/audit";
