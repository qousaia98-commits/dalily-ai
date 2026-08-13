/**
 * Insight + recommendation generators — advisory only.
 */

import type { CollectedBusinessRaw } from "@/lib/business-assistant/collect";
import type {
  BusinessInsight,
  BusinessRecommendation,
  GrowthOpportunity,
  MorningBriefing,
} from "@/lib/business-assistant/types";
import { BUSINESS_ADVISORY_NOTICE, BUSINESS_MODEL_VERSION } from "@/lib/business-assistant/types";

export function generateInsights(raw: CollectedBusinessRaw): BusinessInsight[] {
  const out: BusinessInsight[] = [];

  if (raw.responseImproved) {
    out.push({
      code: "response_improved",
      category: "quality",
      labelEn: "Your response time improved by about 18%.",
      labelAr: "تحسّن زمن استجابتك بنحو 18٪.",
      severity: "positive",
    });
  }

  if (raw.ratingAvg >= 4.3 && raw.reviewCount >= 3) {
    out.push({
      code: "customers_recommend",
      category: "reputation",
      labelEn: "Customers recommend you more frequently.",
      labelAr: "العملاء يوصون بك بشكل متكرر أكثر.",
      severity: "positive",
    });
  }

  if (raw.weekendShare >= 0.35) {
    out.push({
      code: "weekend_demand_up",
      category: "bookings",
      labelEn: "Weekend demand is increasing.",
      labelAr: "طلب عطلة نهاية الأسبوع في ارتفاع.",
      severity: "info",
    });
  }

  if (raw.topCategory) {
    out.push({
      code: "top_revenue_category",
      category: "revenue",
      labelEn: `${raw.topCategory} jobs generate strong revenue for you.`,
      labelAr: `وظائف ${raw.topCategory} تحقق إيراداً قوياً لك.`,
      severity: "info",
    });
  }

  if (raw.completionRate < 0.55 && raw.bookings >= 3) {
    out.push({
      code: "completion_soft",
      category: "quality",
      labelEn: "Completion rate dipped — follow through on open jobs.",
      labelAr: "انخفض معدل الإنجاز — تابع الأعمال المفتوحة.",
      severity: "warning",
    });
  }

  if (raw.capacityUsage < 0.35) {
    out.push({
      code: "capacity_idle",
      category: "capacity",
      labelEn: "Capacity is underused — fill idle gaps for more revenue.",
      labelAr: "السعة غير مستغلة — املأ فجوات الخمول لمزيد من الإيراد.",
      severity: "info",
    });
  }

  if (out.length === 0) {
    out.push({
      code: "steady_business",
      category: "general",
      labelEn: "Your business metrics look steady this period.",
      labelAr: "مؤشرات عملك تبدو مستقرة في هذه الفترة.",
      severity: "info",
    });
  }

  return out.slice(0, 6);
}

export function generateRecommendations(
  raw: CollectedBusinessRaw,
): BusinessRecommendation[] {
  const out: BusinessRecommendation[] = [];

  if (raw.capacityUsage < 0.6) {
    out.push({
      code: "evening_bookings",
      titleEn: "Accept more evening bookings",
      titleAr: "اقبل المزيد من حجوزات المساء",
      bodyEn: "Evening slots often convert well with lower travel congestion.",
      bodyAr: "فترات المساء غالباً تتحول جيداً مع ازدحام أقل.",
      priority: 0.75,
    });
  }

  if (raw.weekendShare < 0.3) {
    out.push({
      code: "friday_availability",
      titleEn: "Increase availability on Fridays",
      titleAr: "زِد التوافر يوم الجمعة",
      bodyEn: "Friday demand is rising in your cohort.",
      bodyAr: "طلب يوم الجمعة يرتفع في مجموعتك.",
      priority: 0.7,
    });
  }

  if (!raw.verified) {
    out.push({
      code: "complete_verification",
      titleEn: "Complete verification",
      titleAr: "أكمل التحقق",
      bodyEn: "Verified providers win more trust and unlocks.",
      bodyAr: "المزودون الموثّقون يكسبون ثقة وفرص فتح أكثر.",
      priority: 0.9,
    });
  }

  if ((raw.responseTimeMin ?? 99) > 35) {
    out.push({
      code: "improve_response",
      titleEn: "Improve response time",
      titleAr: "حسّن زمن الاستجابة",
      bodyEn: "Faster replies lift acceptance and ranking.",
      bodyAr: "الردود الأسرع ترفع القبول والترتيب.",
      priority: 0.8,
    });
  }

  if (raw.acceptanceRate < 0.4) {
    out.push({
      code: "adjust_pricing",
      titleEn: "Adjust pricing toward the fair market range",
      titleAr: "عدّل التسعير نحو النطاق السوقي العادل",
      bodyEn: "Use pricing intelligence — you still set the final price.",
      bodyAr: "استخدم ذكاء التسعير — أنت تحدد السعر النهائي.",
      priority: 0.65,
    });
  }

  if (raw.capacityUsage >= 0.85) {
    out.push({
      code: "vacation_low_demand",
      titleEn: "Plan vacation during low-demand periods",
      titleAr: "خطّط إجازة في فترات الطلب المنخفض",
      bodyEn: "Protect recovery without missing peak revenue days.",
      bodyAr: "احمِ التعافي دون تفويت أيام الذروة.",
      priority: 0.55,
    });
  }

  out.push({
    code: "expand_nearby",
    titleEn: "Expand to nearby regions",
    titleAr: "توّسع إلى مناطق قريبة",
    bodyEn: "Short-travel jobs improve utilization and ratings.",
    bodyAr: "الأعمال ذات السفر القصير تحسّن الاستغلال والتقييم.",
    priority: 0.5,
  });

  return out.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

export function generateGrowthOpportunities(
  raw: CollectedBusinessRaw,
): GrowthOpportunity[] {
  const opportunities: GrowthOpportunity[] = [
    {
      code: "new_category",
      titleEn: "Add an adjacent service category",
      titleAr: "أضف فئة خدمة مجاورة",
      kind: "category",
    },
    {
      code: "nearby_region",
      titleEn: "Test a nearby expansion region",
      titleAr: "جرّب منطقة توسّع قريبة",
      kind: "region",
    },
    {
      code: "upsell_materials",
      titleEn: "Upsell materials packages on high-value jobs",
      titleAr: "قدّم حزم مواد في الأعمال عالية القيمة",
      kind: "upsell",
    },
    {
      code: "repeat_customers",
      titleEn: "Re-engage repeat customers this week",
      titleAr: "أعد التواصل مع العملاء المتكررين هذا الأسبوع",
      kind: "repeat",
    },
    {
      code: "premium_service",
      titleEn: "Offer a premium same-day option",
      titleAr: "قدّم خياراً مميزاً في نفس اليوم",
      kind: "premium",
    },
    {
      code: "partnership_future",
      titleEn: "Business partnerships (coming soon)",
      titleAr: "شراكات أعمال (قريباً)",
      kind: "partnership",
    },
  ];
  return opportunities.slice(0, raw.verified ? 5 : 6);
}

export function generateMorningBriefing(
  raw: CollectedBusinessRaw,
): MorningBriefing {
  const today = new Date().toISOString().slice(0, 10);
  const revenueForecast = Math.round(raw.revenue / 30 + raw.jobsToday * 140_000);

  return {
    briefingDate: today,
    summaryEn: `Good morning${raw.providerName ? `, ${raw.providerName}` : ""}. Health score ${Math.round(raw.businessHealthScore * 100)}% with ${raw.jobsToday} jobs on the board today.`,
    summaryAr: `صباح الخير${raw.providerName ? `، ${raw.providerName}` : ""}. درجة صحة العمل ${Math.round(raw.businessHealthScore * 100)}٪ مع ${raw.jobsToday} أعمال اليوم.`,
    todaysBookings: raw.jobsToday,
    revenueForecast,
    busyHours: ["09:00–12:00", "17:00–20:00"],
    idleGaps: raw.capacityUsage < 0.7 ? ["Mid-afternoon window"] : [],
    highDemandRegions: ["Nearby dense districts"],
    recommendedOpportunities:
      raw.capacityUsage < 0.75
        ? ["Fill evening gaps", "Respond to nearby urgent requests"]
        : ["Protect break time", "Focus on high-value jobs"],
    reminders: [
      !raw.verified ? "Complete verification when you can." : "Keep response times under 30 minutes.",
      "Review tomorrow’s first departure time.",
    ],
    algorithmVersion: BUSINESS_MODEL_VERSION,
    advisoryNotice: BUSINESS_ADVISORY_NOTICE,
  };
}
