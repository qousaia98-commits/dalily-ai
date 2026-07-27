/**
 * AI risk explanation layer — builds admin-facing analysis from computation.
 */

import type { AiRiskAnalysis, RiskComputation } from "@/lib/fraud/types";

export function analyzeRiskComputation(
  computation: RiskComputation,
  extras?: {
    relatedEvents?: string[];
    duplicateCandidates?: string[];
    priorEventCount?: number;
  },
): AiRiskAnalysis {
  const repeatBehaviour = (extras?.priorEventCount ?? 0) >= 2;
  const severity = computation.riskLevel;

  let explanation = computation.explanation;
  if (repeatBehaviour) {
    explanation += " Repeat behaviour detected for this entity.";
  }
  if ((extras?.duplicateCandidates?.length ?? 0) > 0) {
    explanation += ` Possible duplicate accounts: ${extras!.duplicateCandidates!.slice(0, 3).join(", ")}.`;
  }

  return {
    explanation,
    triggeredRules: computation.triggeredRules,
    confidence: computation.confidence,
    severity,
    suggestedAction: computation.suggestedAction,
    relatedEvents: extras?.relatedEvents ?? [],
    duplicateCandidates: extras?.duplicateCandidates ?? [],
    repeatBehaviour,
  };
}
