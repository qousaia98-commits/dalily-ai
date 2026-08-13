/**
 * Collect marketplace-wide raw signals (aggregated; no PII).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { GlobalMarketplaceMetrics } from "@/lib/marketplace-intelligence/types";

export type CollectedMarketplaceRaw = GlobalMarketplaceMetrics & {
  categoryKeys: string[];
  regionKeys: string[];
  openQualityCases: number;
  openFraudCases: number;
  providerCount: number;
  bookingSample: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export async function collectMarketplaceRaw(): Promise<CollectedMarketplaceRaw> {
  const admin = createAdminClient();

  let bookings = 0;
  let completed = 0;
  let cancelled = 0;
  let providerCount = 0;
  let openQualityCases = 0;
  let openFraudCases = 0;
  const categoryKeys = new Set<string>();
  const regionKeys = new Set<string>();

  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const { data } = await admin
      .from("bookings")
      .select("id, status, location_text, metadata")
      .gte("created_at", since.toISOString())
      .limit(500);
    bookings = data?.length ?? 0;
    for (const row of data ?? []) {
      if (["completed", "customer_confirmed"].includes(String(row.status))) completed += 1;
      if (String(row.status).includes("cancel")) cancelled += 1;
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const cat = meta.category_key ?? meta.category;
      if (typeof cat === "string" && cat) categoryKeys.add(cat);
      const city = meta.city ?? meta.region ?? row.location_text;
      if (typeof city === "string" && city.length > 0 && city.length < 64) {
        regionKeys.add(city.toLowerCase().slice(0, 48));
      }
    }
  } catch {
    /* soft */
  }

  try {
    const { count } = await admin
      .from("providers")
      .select("id", { count: "exact", head: true });
    providerCount = count ?? 0;
  } catch {
    /* soft */
  }

  try {
    const { count } = await admin
      .from("quality_cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "investigating", "pending"]);
    openQualityCases = count ?? 0;
  } catch {
    /* soft */
  }

  try {
    const { count } = await admin
      .from("fraud_events")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null)
      .eq("false_positive", false);
    openFraudCases = count ?? 0;
  } catch {
    /* soft */
  }

  // Enrich from forecast snapshots when present
  try {
    const { data } = await admin
      .from("forecast_market_snapshots")
      .select("category_key, region_key, demand_index")
      .limit(80);
    for (const m of data ?? []) {
      if (m.category_key && m.category_key !== "all") categoryKeys.add(m.category_key);
      if (m.region_key && m.region_key !== "all") regionKeys.add(m.region_key);
    }
  } catch {
    /* soft */
  }

  if (categoryKeys.size === 0) {
    ["cleaning", "plumbing", "gardening", "electrical"].forEach((c) => categoryKeys.add(c));
  }
  if (regionKeys.size === 0) {
    ["amman", "zarqa", "irbid"].forEach((r) => regionKeys.add(r));
  }

  const completionRate = bookings > 0 ? completed / bookings : 0.62;
  const cancellationRate = bookings > 0 ? cancelled / bookings : 0.08;
  const acceptanceRate = clamp01(0.55 + completionRate * 0.25);
  const demand = clamp01(0.35 + Math.min(0.5, bookings / 200));
  const supply = clamp01(0.3 + Math.min(0.55, providerCount / 80));
  const liquidity = clamp01((demand + supply) / 2);
  const qualityTrends = clamp01(0.7 - openQualityCases / 40);
  const fraudTrends = clamp01(openFraudCases / 20);
  const businessHealth = clamp01(
    0.25 * completionRate +
      0.2 * acceptanceRate +
      0.2 * liquidity +
      0.2 * qualityTrends +
      0.15 * (1 - fraudTrends),
  );

  const revenue = Math.round(bookings * 95_000 + completed * 40_000);

  return {
    marketplaceGrowth: clamp01(0.4 + bookings / 400),
    bookings,
    revenue,
    demand,
    supply,
    providerActivity: clamp01(providerCount / 100),
    customerActivity: clamp01(bookings / 150),
    completionRate,
    acceptanceRate,
    cancellationRate,
    responseTimesMin: 22,
    reviewTrends: 0.68,
    trustDistribution: 0.72,
    fraudTrends,
    qualityTrends,
    pricingTrends: 0.55,
    forecastAccuracy: 0.71,
    schedulingEfficiency: 0.66,
    businessHealth,
    customerSatisfaction: 0.74,
    marketplaceLiquidity: liquidity,
    healthScore: businessHealth,
    categoryKeys: [...categoryKeys].slice(0, 12),
    regionKeys: [...regionKeys].slice(0, 12),
    openQualityCases,
    openFraudCases,
    providerCount,
    bookingSample: bookings,
  };
}
