/**
 * SAD Provider domain facade (Sprint 0).
 * @see docs/architecture/sad-boundaries.md
 */

export const PROVIDER_DOMAIN = {
  service: "provider",
  owns: ["business_profile", "service_areas", "capabilities", "pause_state"],
  impl: ["src/lib/providers", "src/lib/business"],
  status: "facade",
} as const;

export {
  evaluateMediaReadiness,
  getApprovalReadiness,
  type ApprovalReadiness,
} from "@/lib/providers/approval-readiness";
