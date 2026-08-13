/**
 * Human-readable reputation explanations.
 * Public audience: positive only.
 * Provider/admin: improvements allowed.
 */

import type {
  ReputationComputation,
  ReputationExplanation,
  SignalResult,
} from "@/lib/reputation/types";

type Locale = "en" | "ar";

const POSITIVE_RULES: Array<{
  key: string;
  test: (s: SignalResult[], c: ReputationComputation) => boolean;
  en: string;
  ar: string;
  signalKey?: string;
}> = [
  {
    key: "praise_punctuality",
    test: (s) => (find(s, "on_time_arrival")?.normalizedValue ?? 0) >= 0.8,
    en: "Customers consistently praise punctuality.",
    ar: "يثني العملاء باستمرار على الالتزام بالمواعيد.",
    signalKey: "on_time_arrival",
  },
  {
    key: "verified_fast_response",
    test: (s, c) =>
      (find(s, "business_verified")?.normalizedValue ?? 0) >= 0.9 &&
      (find(s, "avg_response_time")?.normalizedValue ?? 0) >= 0.75,
    en: "Verified business with excellent response times.",
    ar: "نشاط موثّق مع أوقات رد ممتازة.",
    signalKey: "business_verified",
  },
  {
    key: "returning_customers",
    test: (s) =>
      (find(s, "repeat_customers")?.normalizedValue ?? 0) >= 0.55 &&
      (find(s, "recommendation_rate")?.normalizedValue ?? 0) >= 0.7,
    en: "Frequently recommended by returning customers.",
    ar: "يُوصى به كثيراً من العملاء العائدين.",
    signalKey: "repeat_customers",
  },
  {
    key: "high_completion",
    test: (s) => (find(s, "completion_rate")?.normalizedValue ?? 0) >= 0.8,
    en: "High completion rate over the last six months.",
    ar: "معدل إنجاز مرتفع خلال الأشهر الستة الماضية.",
    signalKey: "completion_rate",
  },
  {
    key: "strong_ratings",
    test: (s) =>
      (find(s, "average_rating")?.normalizedValue ?? 0) >= 0.88 &&
      (find(s, "review_count")?.normalizedValue ?? 0) >= 0.35,
    en: "Strong ratings backed by many verified reviews.",
    ar: "تقييمات قوية مدعومة بمراجعات موثّقة كثيرة.",
    signalKey: "average_rating",
  },
  {
    key: "professional_comms",
    test: (s) =>
      (find(s, "provider_response_rate")?.normalizedValue ?? 0) >= 0.7 &&
      (find(s, "avg_response_time")?.normalizedValue ?? 0) >= 0.65,
    en: "Known for clear and timely communication.",
    ar: "معروف بالتواصل الواضح والسريع.",
    signalKey: "avg_response_time",
  },
  {
    key: "reliable_completion",
    test: (s) =>
      (find(s, "cancellation_rate")?.normalizedValue ?? 0) >= 0.8 &&
      (find(s, "completed_jobs")?.normalizedValue ?? 0) >= 0.4,
    en: "Reliable track record with few cancellations.",
    ar: "سجل موثوق مع عدد قليل من الإلغاءات.",
    signalKey: "cancellation_rate",
  },
  {
    key: "rising_trust",
    test: (_s, c) => c.trend === "rising" && c.trustLevel !== "new_provider",
    en: "Trust indicators have been improving recently.",
    ar: "مؤشرات الثقة تتحسن مؤخراً.",
  },
];

const IMPROVEMENT_RULES: Array<{
  key: string;
  test: (s: SignalResult[]) => boolean;
  en: string;
  ar: string;
  signalKey?: string;
}> = [
  {
    key: "respond_faster",
    test: (s) => (find(s, "avg_response_time")?.normalizedValue ?? 1) < 0.45,
    en: "Respond within one hour to improve visibility.",
    ar: "الرد خلال ساعة واحدة يحسّن الظهور في البحث.",
    signalKey: "avg_response_time",
  },
  {
    key: "complete_profile",
    test: (s) => (find(s, "profile_completeness")?.normalizedValue ?? 1) < 0.7,
    en: "Complete your profile to unlock more trust signals.",
    ar: "أكمل ملفك لإظهار المزيد من إشارات الثقة.",
    signalKey: "profile_completeness",
  },
  {
    key: "reply_to_reviews",
    test: (s) => (find(s, "provider_response_rate")?.normalizedValue ?? 1) < 0.4,
    en: "Reply to customer reviews to strengthen reputation.",
    ar: "الرد على تقييمات العملاء يعزّز سمعتك.",
    signalKey: "provider_response_rate",
  },
  {
    key: "lower_cancellations",
    test: (s) => (find(s, "cancellation_rate")?.normalizedValue ?? 1) < 0.45,
    en: "Reducing cancellations will improve your trust level.",
    ar: "تقليل الإلغاءات يحسّن مستوى الثقة.",
    signalKey: "cancellation_rate",
  },
  {
    key: "get_verified",
    test: (s) => (find(s, "business_verified")?.normalizedValue ?? 1) < 0.7,
    en: "Finish business verification to raise search ranking.",
    ar: "أكمل توثيق النشاط لرفع ترتيب البحث.",
    signalKey: "business_verified",
  },
];

function find(signals: SignalResult[], key: string) {
  return signals.find((s) => s.signalKey === key);
}

export function generateExplanations(
  computation: ReputationComputation,
  locales: Locale[] = ["en", "ar"],
): ReputationExplanation[] {
  const out: ReputationExplanation[] = [];
  let sort = 0;

  for (const locale of locales) {
    for (const rule of POSITIVE_RULES) {
      if (!rule.test(computation.signals, computation)) continue;
      out.push({
        audience: "public",
        locale,
        explanationKey: rule.key,
        body: locale === "ar" ? rule.ar : rule.en,
        polarity: "positive",
        signalKey: rule.signalKey,
        sortOrder: sort++,
      });
    }

    for (const rule of IMPROVEMENT_RULES) {
      if (!rule.test(computation.signals)) continue;
      out.push({
        audience: "provider",
        locale,
        explanationKey: rule.key,
        body: locale === "ar" ? rule.ar : rule.en,
        polarity: "improvement",
        signalKey: rule.signalKey,
        sortOrder: sort++,
      });
      out.push({
        audience: "admin",
        locale,
        explanationKey: rule.key,
        body: locale === "ar" ? rule.ar : rule.en,
        polarity: "improvement",
        signalKey: rule.signalKey,
        sortOrder: sort++,
      });
    }

    // Admin gets category snapshot summary
    out.push({
      audience: "admin",
      locale,
      explanationKey: "internal_score_note",
      body:
        locale === "ar"
          ? `النتيجة الداخلية ${computation.internalScore} — المستوى ${computation.trustLevel}.`
          : `Internal score ${computation.internalScore} — level ${computation.trustLevel}.`,
      polarity: "neutral",
      sortOrder: sort++,
    });
  }

  return out.slice(0, 40);
}

export function pickPublicExplanations(
  items: ReputationExplanation[],
  locale: Locale,
  limit = 3,
): Array<{ key: string; body: string }> {
  return items
    .filter((e) => e.audience === "public" && e.polarity === "positive" && e.locale === locale)
    .slice(0, limit)
    .map((e) => ({ key: e.explanationKey, body: e.body }));
}
