/**
 * Public pricing explanations — no internal formula exposure.
 */

import type {
  PricingRawSignals,
  PricingSignalResult,
  PublicPriceExplanation,
} from "@/lib/pricing-engine/types";

export function buildPricingExplanations(input: {
  raw: PricingRawSignals;
  signals: PricingSignalResult[];
}): PublicPriceExplanation[] {
  const out: PublicPriceExplanation[] = [];
  const byKey = new Map(input.signals.map((s) => [s.signalKey, s]));

  if ((byKey.get("market_demand")?.factor ?? 1) >= 1.12) {
    out.push({
      code: "high_demand",
      labelEn: "High demand today.",
      labelAr: "طلب مرتفع اليوم.",
    });
  }
  if (input.raw.largeProject) {
    out.push({
      code: "large_project",
      labelEn: "Large project.",
      labelAr: "مشروع كبير.",
    });
  }
  if ((byKey.get("provider_reputation")?.factor ?? 1) >= 1.08) {
    out.push({
      code: "premium_provider",
      labelEn: "Premium provider.",
      labelAr: "مزود مميز.",
    });
  }
  if (input.raw.distanceKm != null && input.raw.distanceKm > 10) {
    out.push({
      code: "long_travel",
      labelEn: "Long travel distance.",
      labelAr: "مسافة سفر طويلة.",
    });
  }
  if (input.raw.weekend || input.raw.holiday) {
    out.push({
      code: "weekend_surcharge",
      labelEn: "Weekend surcharge.",
      labelAr: "رسوم عطلة نهاية الأسبوع.",
    });
  }
  if (input.raw.urgency01 >= 0.7) {
    out.push({
      code: "urgent",
      labelEn: "Urgent timing.",
      labelAr: "توقيت عاجل.",
    });
  }
  if (input.raw.repeatCustomer) {
    out.push({
      code: "repeat_customer",
      labelEn: "Repeat customer discount opportunity.",
      labelAr: "فرصة خصم لعميل متكرر.",
    });
  }
  if (input.raw.materials01 >= 0.5) {
    out.push({
      code: "materials",
      labelEn: "Materials may affect the quote.",
      labelAr: "المواد قد تؤثر على العرض.",
    });
  }

  if (out.length === 0) {
    out.push({
      code: "fair_market",
      labelEn: "Aligned with the fair market range.",
      labelAr: "متوافق مع النطاق السوقي العادل.",
    });
  }

  return out.slice(0, 4);
}
