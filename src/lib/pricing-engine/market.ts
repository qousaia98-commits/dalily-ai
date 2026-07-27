/**
 * Market analytics helpers — cached stats + incremental refresh.
 */

export {
  invalidatePricingMarketCache,
} from "@/lib/pricing-engine/collect";
export { refreshMarketDataSnapshot } from "@/lib/pricing-engine/service";

export type MarketTrendRow = {
  categoryKey: string;
  regionKey: string;
  avgPrice: number | null;
  demandIndex: number;
  acceptanceRate: number | null;
  completionRate: number | null;
  sampleCount: number;
};

import { createAdminClient } from "@/lib/supabase/admin";

export async function listMarketAnalytics(limit = 50): Promise<MarketTrendRow[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("pricing_market_data")
      .select("*")
      .order("computed_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((m) => ({
      categoryKey: m.category_key,
      regionKey: m.region_key,
      avgPrice: m.avg_price != null ? Number(m.avg_price) : null,
      demandIndex: Number(m.demand_index),
      acceptanceRate:
        m.acceptance_rate != null ? Number(m.acceptance_rate) : null,
      completionRate:
        m.completion_rate != null ? Number(m.completion_rate) : null,
      sampleCount: m.sample_count,
    }));
  } catch {
    return [];
  }
}
