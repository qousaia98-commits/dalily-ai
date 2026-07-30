/**
 * Marketplace analytics / insights bridge.
 */

import {
  isAiAnalyticsEnabled,
  isAiPlatformEnabled,
  isForecastEngineEnabled,
  isAiMarketplaceIntelligenceEnabled,
  isAiOpsEnabled,
} from "@/lib/config/feature-flags";

export async function getMarketplaceInsightsOverview(): Promise<{
  advisoryOnly: true;
  modules: {
    forecast: boolean;
    marketplaceIntelligence: boolean;
    aiOps: boolean;
  };
  note: string;
} | null> {
  if (!isAiPlatformEnabled() || !isAiAnalyticsEnabled()) return null;

  return {
    advisoryOnly: true,
    modules: {
      forecast: isForecastEngineEnabled(),
      marketplaceIntelligence: isAiMarketplaceIntelligenceEnabled(),
      aiOps: isAiOpsEnabled(),
    },
    note: "Detailed forecasts and sims live in Forecast / Marketplace Intelligence / AI Ops admin centers.",
  };
}
