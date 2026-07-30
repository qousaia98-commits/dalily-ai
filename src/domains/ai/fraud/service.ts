/**
 * Fraud analysis facade — recommendations only; never auto-ban.
 */

import {
  isAiFraudEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { getAdminFraudDashboard } from "@/lib/fraud/queries";
import { recalculateEntityRisk } from "@/lib/fraud/service";
import type { RiskEntityType } from "@/lib/fraud/types";
import type { AiFraudAnalysisView } from "@/domains/ai/shared/types";

export async function analyzeEntityFraud(input: {
  entityType: RiskEntityType;
  entityId: string;
}): Promise<AiFraudAnalysisView | null> {
  if (!isAiPlatformEnabled() || !isAiFraudEnabled()) return null;

  const result = await recalculateEntityRisk({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  if (!result.ok) {
    return {
      riskLevel: "low",
      reasons: [result.error || "analysis_unavailable"],
      suggestedAdminAction: "none",
      neverAutoBan: true,
    };
  }

  const score = result.data;
  const normalized = score.riskLevel;

  return {
    riskLevel: normalized,
    reasons:
      score.triggeredRules.length > 0
        ? score.triggeredRules
        : score.explanation
          ? [score.explanation]
          : ["No elevated signals"],
    suggestedAdminAction:
      normalized === "critical" || normalized === "high"
        ? "investigate"
        : normalized === "medium"
          ? "monitor"
          : "none",
    neverAutoBan: true,
  };
}

export async function getFraudDashboardBridge() {
  if (!isAiPlatformEnabled() || !isAiFraudEnabled()) return null;
  return getAdminFraudDashboard();
}
