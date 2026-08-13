/**
 * AI bridge — Sprint 8 Phase 6 Marketplace Intelligence Platform.
 */

import { isAiMarketplaceIntelligenceEnabled } from "@/lib/config/feature-flags";
import { getMarketplaceIntelligencePlatform } from "@/lib/marketplace-intelligence";
import type { MarketplaceIntelligencePlatform } from "@/lib/marketplace-intelligence";

export const marketplaceIntelligenceModule = {
  id: "ai-marketplace-intelligence",
  status: "sprint8-phase6" as const,
  impl: [
    "src/lib/marketplace-intelligence/",
    "src/lib/business-assistant/",
    "src/lib/forecast-engine/",
    "src/lib/pricing-engine/",
    "src/lib/matching-engine/",
    "src/lib/scheduling-engine/",
  ],
  future: [
    "LLM executive summaries",
    "Forecast ensembles",
    "Reinforcement learning experiments",
    "Shadow ML deployments",
    "Autonomous agents with authorization gates",
    "Multi-region distributed aggregation",
  ],
};

export async function getMarketplaceIntelligenceDashboard(): Promise<MarketplaceIntelligencePlatform | null> {
  if (!isAiMarketplaceIntelligenceEnabled()) return null;
  return getMarketplaceIntelligencePlatform({ persist: false });
}
