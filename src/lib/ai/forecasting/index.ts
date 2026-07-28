/**
 * AI Forecast Bridge (thin) — INTERNAL.
 *
 * Responsibilities: façade metadata, feature-flag gating, re-export of engine
 * public helpers for AI module registry. Forecasting math lives in forecast-engine.
 *
 * External consumers MUST use `@/domains/forecast`.
 *
 * @see docs/architecture/forecast.md
 */
import { isForecastEngineEnabled } from "@/lib/config/feature-flags";
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
  impl: [
    "src/domains/forecast (public API)",
    "src/lib/forecast-engine/ (runtime engine)",
    "src/lib/ai/predictive/demand.ts (legacy predictive demand model)",
  ],
  responsibilities: ["facade", "featureFlags", "providerRouting", "telemetry"] as const,
  future: ["weather API", "economic indicators feed", "full ML time-series"],
};

export async function getPublicDemandForecasts(input: {
  categoryKey: string;
  regionKey?: string | null;
}): Promise<PublicDemandForecast[]> {
  if (!isForecastEngineEnabled()) return [];
  const comps = await generateMultiHorizonForecast({
    categoryKey: input.categoryKey,
    regionKey: input.regionKey,
    persist: false,
  });
  return comps.map(toPublicDemandForecast);
}

export { getCustomerDemandHint, getProviderForecastInsights };

export type { PublicDemandForecast, CustomerDemandHint, ProviderForecastInsights };
