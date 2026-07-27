/**
 * Demand forecasting bridge — Sprint 8 Phase 3.
 * Legacy predictive/demand.ts remains for AI Engine Phase 8 dashboards.
 */
import { isAiDemandForecastingEnabled } from "@/lib/config/feature-flags";
import {
  generateMultiHorizonForecast,
  getCustomerDemandHint,
  getProviderForecastInsights,
  toPublicDemandForecast,
  type PublicDemandForecast,
  type CustomerDemandHint,
  type ProviderForecastInsights,
} from "@/lib/forecast-engine";

export const forecastingModule = {
  id: "demand-forecasting",
  status: "sprint8-phase3" as const,
  impl: ["src/lib/forecast-engine/", "src/lib/ai/predictive/demand.ts"],
  future: ["weather API", "economic indicators feed", "full ML time-series"],
};

export async function getPublicDemandForecasts(input: {
  categoryKey: string;
  regionKey?: string | null;
}): Promise<PublicDemandForecast[]> {
  if (!isAiDemandForecastingEnabled()) return [];
  const comps = await generateMultiHorizonForecast({
    categoryKey: input.categoryKey,
    regionKey: input.regionKey,
    persist: false,
  });
  return comps.map(toPublicDemandForecast);
}

export { getCustomerDemandHint, getProviderForecastInsights };

export type { PublicDemandForecast, CustomerDemandHint, ProviderForecastInsights };
