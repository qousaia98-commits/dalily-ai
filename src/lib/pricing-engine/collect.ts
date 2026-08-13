/**
 * Collect pricing raw signals from market data + context.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { PricingRawSignals } from "@/lib/pricing-engine/types";

export type PriceRecommendInput = {
  categoryKey: string;
  regionKey?: string | null;
  currency?: string;
  distanceKm?: number | null;
  complexity01?: number;
  durationHours?: number;
  urgency01?: number;
  materials01?: number;
  reputationBoost?: number | null;
  experience01?: number;
  repeatCustomer?: boolean;
  businessCustomer?: boolean;
  largeProject?: boolean;
  holiday?: boolean;
  mlPriceFactor?: number | null;
  /** Optional catalog seed when market table empty */
  catalogMin?: number;
  catalogTypical?: number;
  catalogMax?: number;
};

const MARKET_CACHE = new Map<
  string,
  { at: number; avg: number; min: number; max: number; demand: number }
>();
const MARKET_TTL_MS = 5 * 60_000;

export async function collectPricingRaw(
  input: PriceRecommendInput,
): Promise<PricingRawSignals> {
  const categoryKey = input.categoryKey || "general";
  const regionKey = input.regionKey || "all";
  const currency = input.currency || "SYP";
  const cacheKey = `${categoryKey}:${regionKey}:${currency}`;

  let avg = input.catalogTypical ?? 150_000;
  let min = input.catalogMin ?? Math.round(avg * 0.6);
  let max = input.catalogMax ?? Math.round(avg * 2);
  let demand = 0.5;
  let historicalAvg: number | null = null;

  const cached = MARKET_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < MARKET_TTL_MS) {
    avg = cached.avg;
    min = cached.min;
    max = cached.max;
    demand = cached.demand;
  } else {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("pricing_market_data")
        .select("*")
        .eq("category_key", categoryKey)
        .eq("region_key", regionKey)
        .eq("currency", currency)
        .maybeSingle();

      if (data?.avg_price != null) {
        avg = Number(data.avg_price);
        min = Number(data.min_price ?? avg * 0.6);
        max = Number(data.max_price ?? avg * 2);
        demand = Number(data.demand_index ?? 0.5);
      } else {
        // Soft seed from recent offers if table empty
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: offers } = await (admin as any)
          .from("marketplace_offers")
          .select("price")
          .not("price", "is", null)
          .order("created_at", { ascending: false })
          .limit(40);
        const prices = (offers ?? [])
          .map((o: { price: number }) => Number(o.price))
          .filter((n: number) => n > 0);
        if (prices.length >= 3) {
          avg = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);
          min = Math.min(...prices);
          max = Math.max(...prices);
          historicalAvg = avg;
        }
      }

      MARKET_CACHE.set(cacheKey, {
        at: Date.now(),
        avg,
        min,
        max,
        demand,
      });
    } catch {
      /* catalog defaults */
    }
  }

  if (historicalAvg == null) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("pricing_feedback")
        .select("offered_price")
        .eq("accepted", true)
        .not("offered_price", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);
      const prices = (data ?? [])
        .map((r) => Number(r.offered_price))
        .filter((n) => n > 0);
      if (prices.length >= 2) {
        historicalAvg =
          Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      }
    } catch {
      /* optional */
    }
  }

  const now = new Date();
  const dow = now.getUTCDay();
  const hour = now.getUTCHours();
  const month = now.getUTCMonth();
  // Simple seasonality: summer peak for AC-like months in region
  const season01 = month >= 5 && month <= 8 ? 0.7 : month <= 1 || month === 11 ? 0.55 : 0.4;

  return {
    categoryKey,
    regionKey,
    currency,
    baseMarketAvg: avg,
    baseMarketMin: min,
    baseMarketMax: max,
    distanceKm: input.distanceKm ?? null,
    travelTimeMin:
      input.distanceKm != null ? Math.round(input.distanceKm * 2.5) : null,
    complexity01: input.complexity01 ?? 0.4,
    durationHours: input.durationHours ?? 2,
    urgency01: input.urgency01 ?? 0.2,
    season01,
    weekend: dow === 5 || dow === 6,
    peakHours: hour >= 16 && hour <= 20,
    historicalAvg,
    demandIndex: demand,
    reputationBoost: input.reputationBoost ?? null,
    experience01: input.experience01 ?? 0.4,
    materials01: input.materials01 ?? 0.2,
    weather01: 0,
    holiday: input.holiday ?? false,
    repeatCustomer: input.repeatCustomer ?? false,
    businessCustomer: input.businessCustomer ?? false,
    largeProject: input.largeProject ?? false,
    mlPriceFactor: input.mlPriceFactor ?? null,
  };
}

export function invalidatePricingMarketCache(): void {
  MARKET_CACHE.clear();
}
