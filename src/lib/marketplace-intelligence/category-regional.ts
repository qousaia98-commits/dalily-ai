/**
 * Category + regional intelligence generators.
 */

import type { CollectedMarketplaceRaw } from "@/lib/marketplace-intelligence/collect";
import type {
  CategoryIntelligence,
  RegionalIntelligence,
  TrendDirection,
} from "@/lib/marketplace-intelligence/types";

function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function direction(n: number): TrendDirection {
  if (n >= 0.58) return "rising";
  if (n <= 0.42) return "declining";
  return "stable";
}

export function generateCategoryIntelligence(
  raw: CollectedMarketplaceRaw,
): CategoryIntelligence[] {
  return raw.categoryKeys.map((categoryKey) => {
    const seed = hash01(categoryKey);
    const demand = Math.min(1, 0.35 + seed * 0.5 + raw.demand * 0.15);
    const growth = Math.min(1, 0.3 + seed * 0.45 + raw.marketplaceGrowth * 0.2);
    const providerDensity = Math.min(1, 0.25 + hash01(categoryKey + "d") * 0.5);
    const competition = Math.min(1, providerDensity * 0.85 + 0.1);
    const opportunityScore = Math.min(
      1,
      demand * 0.45 + growth * 0.35 + (1 - competition) * 0.2,
    );
    const riskScore = Math.min(1, competition * 0.4 + (1 - raw.qualityTrends) * 0.3);
    const dir = direction(growth);

    return {
      categoryKey,
      growth: Number(growth.toFixed(3)),
      demand: Number(demand.toFixed(3)),
      providerDensity: Number(providerDensity.toFixed(3)),
      competition: Number(competition.toFixed(3)),
      averagePricing: Math.round(40_000 + seed * 120_000),
      completionRate: Number((0.5 + seed * 0.35).toFixed(3)),
      quality: Number((0.55 + seed * 0.35).toFixed(3)),
      trust: Number((0.5 + hash01(categoryKey + "t") * 0.4).toFixed(3)),
      profitability: Number((0.4 + seed * 0.45).toFixed(3)),
      seasonality: { spring: 0.6, summer: 0.75, autumn: 0.55, winter: 0.45 + seed * 0.2 },
      peakHours: ["09:00–12:00", "17:00–20:00"],
      forecast: { nextWeek: Number((demand * 1.05).toFixed(3)), direction: dir },
      opportunityScore: Number(opportunityScore.toFixed(3)),
      riskScore: Number(riskScore.toFixed(3)),
      summaryEn: `${categoryKey}: demand ${Math.round(demand * 100)}%, opportunity ${Math.round(opportunityScore * 100)}%, trend ${dir}.`,
      summaryAr: `${categoryKey}: الطلب ${Math.round(demand * 100)}٪، الفرصة ${Math.round(opportunityScore * 100)}٪، الاتجاه ${dir}.`,
    };
  });
}

export function generateRegionalIntelligence(
  raw: CollectedMarketplaceRaw,
): RegionalIntelligence[] {
  return raw.regionKeys.map((regionKey) => {
    const seed = hash01(regionKey);
    const demand = Math.min(1, 0.3 + seed * 0.5 + raw.demand * 0.2);
    const supply = Math.min(1, 0.25 + hash01(regionKey + "s") * 0.5 + raw.supply * 0.15);
    const growth = Math.min(1, 0.28 + seed * 0.48);
    const providerDensity = Math.min(1, supply * 0.9);
    const competition = Math.min(1, providerDensity * 0.8 + 0.1);
    const opportunityScore = Math.min(
      1,
      demand * 0.4 + (1 - supply) * 0.35 + growth * 0.25,
    );
    const expansionPotential = Math.min(1, opportunityScore * 0.85 + (1 - competition) * 0.15);
    const dir = direction(growth);

    return {
      regionKey,
      demand: Number(demand.toFixed(3)),
      supply: Number(supply.toFixed(3)),
      competition: Number(competition.toFixed(3)),
      growth: Number(growth.toFixed(3)),
      providerDensity: Number(providerDensity.toFixed(3)),
      avgResponseMin: Math.round(12 + seed * 28),
      avgTravelKm: Number((3 + seed * 12).toFixed(1)),
      averagePricing: Math.round(35_000 + seed * 90_000),
      customerSatisfaction: Number((0.55 + seed * 0.35).toFixed(3)),
      complaintRate: Number((0.02 + seed * 0.08).toFixed(3)),
      forecast: { nextWeek: Number((demand * 1.04).toFixed(3)), direction: dir },
      opportunityScore: Number(opportunityScore.toFixed(3)),
      expansionPotential: Number(expansionPotential.toFixed(3)),
      heatmap: {
        cells: [
          { lat: 31.95 + seed * 0.1, lng: 35.91 + seed * 0.1, intensity: demand },
          { lat: 31.96 + seed * 0.05, lng: 35.93, intensity: Number((demand * 0.8).toFixed(2)) },
        ],
      },
      summaryEn: `${regionKey}: undersupply gap ${Math.round(Math.max(0, demand - supply) * 100)}%, expansion potential ${Math.round(expansionPotential * 100)}%.`,
      summaryAr: `${regionKey}: فجوة العرض ${Math.round(Math.max(0, demand - supply) * 100)}٪، إمكان التوسّع ${Math.round(expansionPotential * 100)}٪.`,
    };
  });
}
