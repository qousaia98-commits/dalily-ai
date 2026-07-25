/**
 * SAD Provider domain — profile + Sprint 8 dashboard aggregate.
 */

export const PROVIDER_DOMAIN = {
  service: "provider",
  owns: ["business_profile", "service_areas", "capabilities", "pause_state", "dashboard_home"],
  impl: ["src/domains/provider", "src/lib/providers", "src/lib/business"],
  status: "active",
  sprint: 8,
  featureFlag: "PROVIDER_DASHBOARD_V2",
} as const;

export {
  evaluateMediaReadiness,
  getApprovalReadiness,
  type ApprovalReadiness,
} from "@/lib/providers/approval-readiness";

export {
  getProviderDashboardHome,
  type ProviderDashboardHome,
  type ProviderDashboardQaItem,
  type ProviderDashboardActiveJob,
  type ProviderDashboardReliability,
} from "@/domains/provider/dashboard";
