/**
 * Public forecast explanations — advisory only, no internal formulas.
 */

import type {
  ForecastRawSignals,
  ForecastSignalResult,
  ForecastTrend,
  PublicForecastExplanation,
} from "@/lib/forecast-engine/types";

export const FORECAST_ADVISORY_NOTICE =
  "Advisory forecast only — Dalily does not guarantee future demand or outcomes.";

export function buildForecastExplanations(input: {
  raw: ForecastRawSignals;
  signals: ForecastSignalResult[];
  trend: ForecastTrend;
  expectedDemand: number;
}): PublicForecastExplanation[] {
  const out: PublicForecastExplanation[] = [];
  const byKey = new Map(input.signals.map((s) => [s.signalKey, s]));

  if (input.expectedDemand >= input.raw.baselineDemand * 1.2) {
    out.push({
      code: "high_demand",
      labelEn: "High demand expected in this window.",
      labelAr: "طلب مرتفع متوقع في هذه الفترة.",
    });
  } else if (input.expectedDemand <= input.raw.baselineDemand * 0.85) {
    out.push({
      code: "low_demand",
      labelEn: "Lower demand — faster availability likely.",
      labelAr: "طلب أقل — توافر أسرع محتمل.",
    });
  }

  if (input.trend === "rising") {
    out.push({
      code: "rising_trend",
      labelEn: "Demand trend is rising.",
      labelAr: "اتجاه الطلب في ارتفاع.",
    });
  } else if (input.trend === "declining") {
    out.push({
      code: "declining_trend",
      labelEn: "Demand trend is softening.",
      labelAr: "اتجاه الطلب يتراجع.",
    });
  }

  if (input.raw.holiday || input.raw.schoolHoliday) {
    out.push({
      code: "holiday_effect",
      labelEn: "Holiday calendar may shift demand.",
      labelAr: "تقويم العطل قد يغيّر الطلب.",
    });
  }

  if ((byKey.get("weekday_patterns")?.factor ?? 1) >= 1.1) {
    out.push({
      code: "busy_weekday",
      labelEn: "Strong weekday pattern this period.",
      labelAr: "نمط أيام أسبوع قوي في هذه الفترة.",
    });
  }

  if (input.raw.providerAvailability01 < 0.4) {
    out.push({
      code: "tight_supply",
      labelEn: "Provider capacity looks tight — book early if you can.",
      labelAr: "سعة المزودين محدودة — احجز مبكراً إن أمكن.",
    });
  }

  if (out.length === 0) {
    out.push({
      code: "stable_market",
      labelEn: "Demand looks close to the recent baseline.",
      labelAr: "الطلب قريب من خط الأساس الأخير.",
    });
  }

  return out.slice(0, 4);
}
