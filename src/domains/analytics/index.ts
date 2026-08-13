/**
 * SAD Analytics domain skeleton/facade (Sprint 0).
 * Not authoritative for unlock/money (SAD rule).
 */

export const ANALYTICS_DOMAIN = {
  service: "analytics",
  owns: ["derived_kpis", "reputation_feature_projections"],
  impl: ["src/lib/admin/*analytics*", "src/lib/search/learning"],
  status: "skeleton",
  authoritativeForMoney: false,
} as const;
