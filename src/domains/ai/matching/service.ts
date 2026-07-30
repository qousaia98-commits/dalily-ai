/**
 * Matching facade — reuses matching domain + offer decision engine.
 * Never exposes internal weights.
 */

import {
  isAiPlatformEnabled,
  isSmartMatchingEngineEnabled,
  isOfferDecisionEngineEnabled,
} from "@/lib/config/feature-flags";

export async function getMatchingPublicApi() {
  if (!isAiPlatformEnabled()) {
    return { enabled: false as const, engine: null, offerDecision: false };
  }
  return {
    enabled: isSmartMatchingEngineEnabled(),
    offerDecision: isOfferDecisionEngineEnabled(),
    engine: isSmartMatchingEngineEnabled()
      ? "smart_matching_engine"
      : "legacy_ai_match",
  };
}

/** Re-export public matching domain entry when available. */
export async function recommendProvidersViaDomain(input: {
  // Opaque — callers use existing matching/offer APIs; this is a status bridge.
  serviceRequestId?: string;
}): Promise<{ advisoryOnly: true; note: string; requestId?: string }> {
  void input;
  return {
    advisoryOnly: true,
    note: "Use /api/offers/recommendation and matching domain — weights stay server-side.",
    requestId: input.serviceRequestId,
  };
}
