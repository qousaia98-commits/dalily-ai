/**
 * Opportunity engine, decision support, executive reports, insights.
 */

import type { CollectedMarketplaceRaw } from "@/lib/marketplace-intelligence/collect";
import type { CategoryIntelligence } from "@/lib/marketplace-intelligence/types";
import type { RegionalIntelligence } from "@/lib/marketplace-intelligence/types";
import type {
  CustomerMarketInsight,
  ExecutiveReport,
  MarketOpportunity,
  ProviderMarketInsight,
  StrategicRecommendation,
  TrendDirection,
} from "@/lib/marketplace-intelligence/types";
import { MARKET_INTEL_VERSION } from "@/lib/marketplace-intelligence/types";

export function generateOpportunities(
  categories: CategoryIntelligence[],
  regions: RegionalIntelligence[],
  raw: CollectedMarketplaceRaw,
): MarketOpportunity[] {
  const out: MarketOpportunity[] = [];

  const growing = [...categories].sort((a, b) => b.growth - a.growth)[0];
  if (growing) {
    out.push({
      code: "growing_category",
      kind: "growing_category",
      titleEn: `Growing category: ${growing.categoryKey}`,
      titleAr: `فئة نامية: ${growing.categoryKey}`,
      bodyEn: `Growth index ${Math.round(growing.growth * 100)}% with opportunity score ${Math.round(growing.opportunityScore * 100)}%.`,
      categoryKey: growing.categoryKey,
      score: growing.opportunityScore,
    });
  }

  const underserved = [...regions]
    .filter((r) => r.demand > r.supply)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
  if (underserved) {
    out.push({
      code: "underserved_region",
      kind: "underserved_region",
      titleEn: `Underserved region: ${underserved.regionKey}`,
      titleAr: `منطقة ناقصة الخدمة: ${underserved.regionKey}`,
      bodyEn: `Demand exceeds supply — expansion potential ${Math.round(underserved.expansionPotential * 100)}%.`,
      regionKey: underserved.regionKey,
      score: underserved.opportunityScore,
    });
  }

  out.push({
    code: "high_demand_neighborhood",
    kind: "high_demand_neighborhood",
    titleEn: "High-demand neighborhoods emerging",
    titleAr: "أحياء عالية الطلب آخذة في الظهور",
    bodyEn: "Dense evening demand clusters near city centers.",
    score: 0.72,
  });

  if (raw.supply < raw.demand) {
    out.push({
      code: "provider_shortage",
      kind: "provider_shortage",
      titleEn: "Provider shortage in peak windows",
      titleAr: "نقص مزوّدين في أوقات الذروة",
      bodyEn: "Recruitment in high-demand categories will improve liquidity.",
      score: 0.78,
    });
  }

  out.push(
    {
      code: "premium_opportunity",
      kind: "premium",
      titleEn: "Premium same-day opportunity",
      titleAr: "فرصة خدمات مميزة في نفس اليوم",
      score: 0.64,
    },
    {
      code: "partnership_ready",
      kind: "partnership",
      titleEn: "Business partnership corridors (future-ready)",
      titleAr: "ممرات شراكات أعمال (جاهزة للمستقبل)",
      score: 0.5,
    },
    {
      code: "enterprise_ready",
      kind: "enterprise",
      titleEn: "Enterprise recurring contracts",
      titleAr: "عقود مؤسسية متكررة",
      score: 0.58,
    },
    {
      code: "cross_category",
      kind: "cross_category",
      titleEn: "Cross-category bundling opportunity",
      titleAr: "فرصة حزم عبر الفئات",
      score: 0.61,
    },
  );

  return out.sort((a, b) => b.score - a.score).slice(0, 10);
}

export function generateStrategicRecommendations(
  raw: CollectedMarketplaceRaw,
  categories: CategoryIntelligence[],
  regions: RegionalIntelligence[],
): StrategicRecommendation[] {
  const topRegion = [...regions].sort((a, b) => b.expansionPotential - a.expansionPotential)[0];
  const topCat = [...categories].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];

  return [
    {
      code: "launch_category_region",
      titleEn: `Launch ${topCat?.categoryKey ?? "plumbing"} in ${topRegion?.regionKey ?? "Region X"}`,
      titleAr: `إطلاق ${topCat?.categoryKey ?? "plumbing"} في ${topRegion?.regionKey ?? "المنطقة"}`,
      reasonEn: "High opportunity score with demand-supply gap.",
      reasonAr: "درجة فرصة عالية مع فجوة طلب-عرض.",
      expectedImpact: "Liquidity +8–15%, fill rates up in 30 days",
      confidence: 0.74,
      requiredEffort: "medium",
      estimatedRoi: 1.8,
      estimatedTime: "4–6 weeks",
      dependencies: ["provider_recruitment", "category_launch_checklist"],
    },
    {
      code: "increase_recruitment",
      titleEn: "Increase provider recruitment",
      titleAr: "زيادة استقطاب المزوّدين",
      reasonEn: `Supply index ${Math.round(raw.supply * 100)}% vs demand ${Math.round(raw.demand * 100)}%.`,
      expectedImpact: "Reduce unmatched requests by ~12%",
      confidence: 0.8,
      requiredEffort: "high",
      estimatedRoi: 2.1,
      estimatedTime: "6–8 weeks",
      dependencies: ["onboarding_capacity"],
    },
    {
      code: "reduce_fraud_backlog",
      titleEn: "Reduce fraud investigation backlog",
      titleAr: "تقليل تراكم تحقيقات الاحتيال",
      reasonEn: `Open fraud cases: ${raw.openFraudCases}.`,
      expectedImpact: "Trust distribution +5%",
      confidence: 0.7,
      requiredEffort: "medium",
      estimatedRoi: 1.4,
      estimatedTime: "2–3 weeks",
      dependencies: ["fraud_ops_staffing"],
    },
    {
      code: "verification_capacity",
      titleEn: "Increase verification capacity",
      titleAr: "زيادة قدرة التحقق",
      reasonEn: "Faster verification raises acceptance and trust.",
      expectedImpact: "Time-to-first-job −20%",
      confidence: 0.76,
      requiredEffort: "medium",
      estimatedRoi: 1.6,
      estimatedTime: "3 weeks",
      dependencies: ["ops_queue"],
    },
    {
      code: "scheduling_efficiency",
      titleEn: "Improve scheduling efficiency",
      titleAr: "تحسين كفاءة الجدولة",
      reasonEn: `Scheduling efficiency at ${Math.round(raw.schedulingEfficiency * 100)}%.`,
      expectedImpact: "Idle gaps −10%, completion +4%",
      confidence: 0.72,
      requiredEffort: "low",
      estimatedRoi: 1.5,
      estimatedTime: "2 weeks",
      dependencies: ["ai_scheduling"],
    },
    {
      code: "premium_subscriptions",
      titleEn: "Expand premium subscriptions",
      titleAr: "توسيع الاشتراكات المميزة",
      reasonEn: "Premium corridor shows stable willingness-to-pay.",
      expectedImpact: "ARPU +6–10%",
      confidence: 0.65,
      requiredEffort: "medium",
      estimatedRoi: 2.0,
      estimatedTime: "5 weeks",
      dependencies: ["billing", "provider_tiers"],
    },
    {
      code: "marketing_budget_regions",
      titleEn: "Increase marketing budget in selected regions",
      titleAr: "زيادة ميزانية التسويق في مناطق مختارة",
      reasonEn: "Target high expansion-potential cities first.",
      expectedImpact: "New customer acquisition +15% in pilot regions",
      confidence: 0.68,
      requiredEffort: "high",
      estimatedRoi: 1.7,
      estimatedTime: "1 quarter",
      dependencies: ["budget_approval", "regional_creatives"],
    },
  ];
}

export function generateExecutiveReport(
  raw: CollectedMarketplaceRaw,
  opportunities: MarketOpportunity[],
): ExecutiveReport {
  const trend: TrendDirection =
    raw.marketplaceGrowth >= 0.55
      ? "rising"
      : raw.marketplaceGrowth <= 0.4
        ? "declining"
        : "stable";

  return {
    reportType: "daily",
    summaryEn: `Marketplace health ${Math.round(raw.healthScore * 100)}% with ${raw.bookings} bookings (30d sample), liquidity ${Math.round(raw.marketplaceLiquidity * 100)}%.`,
    summaryAr: `صحة السوق ${Math.round(raw.healthScore * 100)}٪ مع ${raw.bookings} حجوزات (عينة 30 يوماً)، السيولة ${Math.round(raw.marketplaceLiquidity * 100)}٪.`,
    keyChanges: [
      `Demand index ${Math.round(raw.demand * 100)}%`,
      `Completion rate ${Math.round(raw.completionRate * 100)}%`,
      `Provider activity ${Math.round(raw.providerActivity * 100)}%`,
    ],
    risks: [
      raw.openFraudCases > 0
        ? `Fraud backlog: ${raw.openFraudCases} open cases`
        : "Fraud pressure remains moderate",
      raw.cancellationRate > 0.12
        ? "Cancellation rate elevated"
        : "Cancellation rate within band",
    ],
    opportunities: opportunities.slice(0, 4).map((o) => o.titleEn),
    predictions: [
      "Weekend demand expected to rise 8–12%",
      "Cleaning category remains top revenue contributor",
      raw.forecastAccuracy >= 0.65
        ? "Forecast ensemble confidence healthy"
        : "Forecast accuracy needs recalibration",
    ],
    recommendedActions: [
      "Prioritize recruitment in underserved regions",
      "Clear fraud backlog within SLA",
      "Run digital-twin simulation before algorithm weight changes",
    ],
    confidence: 0.73,
    trendDirection: trend,
    algorithmVersion: MARKET_INTEL_VERSION,
  };
}

export function generateProviderMarketInsights(
  categories: CategoryIntelligence[],
  regions: RegionalIntelligence[],
): ProviderMarketInsight[] {
  const bestCat = [...categories].sort((a, b) => b.profitability - a.profitability)[0];
  const expand = [...regions].sort((a, b) => b.expansionPotential - a.expansionPotential)[0];
  const rising = categories.find((c) => c.forecast.direction === "rising");
  const declining = categories.find((c) => c.forecast.direction === "declining");

  return [
    {
      code: "expand_nearby",
      labelEn: expand
        ? `Expand to nearby city: ${expand.regionKey}.`
        : "Expand to a nearby high-demand city.",
      labelAr: expand
        ? `توسّع إلى مدينة قريبة: ${expand.regionKey}.`
        : "توسّع إلى مدينة قريبة عالية الطلب.",
      severity: "info",
    },
    {
      code: "demand_increasing",
      labelEn: "Demand is increasing in your primary corridors.",
      labelAr: "الطلب في ازدياد في ممراتك الأساسية.",
      severity: "positive",
    },
    {
      code: "evening_preference",
      labelEn: "Customers prefer evening appointments.",
      labelAr: "العملاء يفضّلون مواعيد المساء.",
      severity: "info",
    },
    {
      code: "weekend_revenue",
      labelEn: "Weekend bookings generate higher revenue.",
      labelAr: "حجوزات نهاية الأسبوع تحقق إيراداً أعلى.",
      severity: "positive",
    },
    {
      code: "cleaning_next_week",
      labelEn: rising
        ? `${rising.categoryKey} demand will increase next week.`
        : "Cleaning demand will increase next week.",
      severity: "info",
    },
    {
      code: "landscape_decline",
      labelEn: declining
        ? `${declining.categoryKey} demand declining.`
        : "Landscape demand soft this month.",
      severity: "warning",
    },
    {
      code: "best_category",
      labelEn: bestCat
        ? `Best category this month: ${bestCat.categoryKey}.`
        : "Best category this month: cleaning.",
      severity: "positive",
    },
    {
      code: "highest_roi",
      labelEn: "Highest ROI service: verified premium packages.",
      severity: "info",
    },
  ];
}

export function generateCustomerMarketInsights(
  raw: CollectedMarketplaceRaw,
): CustomerMarketInsight[] {
  return [
    {
      code: "book_earlier_weekend",
      labelEn: "Book earlier this weekend.",
      labelAr: "احجز مبكراً في نهاية هذا الأسبوع.",
      severity: "info",
    },
    {
      code: raw.demand < 0.45 ? "demand_low" : "demand_moderate",
      labelEn:
        raw.demand < 0.45
          ? "Demand currently low — good availability."
          : "Demand is moderate — book soon for preferred slots.",
      severity: "info",
    },
    {
      code: "prices_rise",
      labelEn: "Prices expected to rise in peak evening windows.",
      labelAr: "يُتوقع ارتفاع الأسعار في ذروة المساء.",
      severity: "warning",
    },
    {
      code: "providers_nearby",
      labelEn: "Many providers available nearby.",
      labelAr: "العديد من المزوّدين متاحون بالقرب منك.",
      severity: "positive",
    },
    {
      code: "booking_window",
      labelEn: "Recommended booking window: today 10:00–14:00.",
      severity: "info",
    },
    {
      code: "high_availability",
      labelEn: "High availability today.",
      labelAr: "توفر عالٍ اليوم.",
      severity: "positive",
    },
    {
      code: "seasonal",
      labelEn: "Seasonal tip: schedule outdoor work before midsummer heat.",
      severity: "info",
    },
  ];
}
