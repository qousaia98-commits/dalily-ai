/**
 * SAD Admin domain — Sprint 9 economy / unlock / trust ops.
 */

export const ADMIN_DOMAIN = {
  service: "admin",
  owns: ["admin_cases", "cell_overrides", "enforcement_actions", "cell_policies"],
  impl: ["src/domains/admin", "src/lib/admin"],
  status: "active",
  sprint: 9,
  featureFlag: "ADMIN_MIGRATION_V2",
} as const;

export { logAdminAudit, type AuditAction } from "@/lib/admin/audit";
export { logAdminAction, listAdminActionLogs } from "@/lib/admin/action-log";

export {
  buildCellKey,
  getCellPolicy,
  listCellPolicies,
  upsertCellPolicy,
  type CellPolicyView,
} from "@/domains/admin/cell-policies";

export {
  getUnlockOpsOverview,
  compUnlockSession,
  type UnlockOpsOverview,
  type UnlockPaymentQueueItem,
} from "@/domains/admin/unlock-ops";

export {
  inspectMarketplaceRequest,
  type MarketplaceInspection,
} from "@/domains/admin/inspection";
