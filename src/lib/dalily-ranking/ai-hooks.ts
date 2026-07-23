/**
 * Future ML / personalization hooks — architecture only (Sprint 40).
 */

import type { DalilyRankingAiExtension } from "@/lib/dalily-ranking/types";

export function listDalilyRankingAiExtensions(): DalilyRankingAiExtension[] {
  return [
    "personalized_recommendations",
    "behavior_based_ranking",
    "seasonal_ranking",
    "demand_prediction",
    "fraud_detection",
  ];
}

export async function runDalilyRankingAiHook(
  extension: DalilyRankingAiExtension,
  _context: Record<string, unknown>,
): Promise<{ extension: DalilyRankingAiExtension; supported: false }> {
  void _context;
  return { extension, supported: false };
}
