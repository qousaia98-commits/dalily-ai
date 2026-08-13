/**
 * Modular matching signal collectors — each independent, 0..1 normalized
 * (negative weights applied in engine for risk signals).
 */

import type { MatchRawSignals } from "@/lib/matching-engine/types";

export type MatchSignalCollector = {
  signalKey: string;
  category: string;
  computeNormalized: (raw: MatchRawSignals) => {
    rawValue: number;
    normalizedValue: number;
    metadata?: Record<string, unknown>;
  };
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export const MATCH_SIGNAL_COLLECTORS: MatchSignalCollector[] = [
  {
    signalKey: "distance",
    category: "geo",
    computeNormalized: (raw) => {
      const km = raw.distanceKm;
      let n = 0.55;
      if (km != null && !Number.isNaN(km)) {
        if (km <= 2) n = 1;
        else if (km <= 5) n = 0.85;
        else if (km <= 10) n = 0.65;
        else if (km <= 20) n = 0.4;
        else n = 0.2;
      }
      return { rawValue: km ?? -1, normalizedValue: n };
    },
  },
  {
    signalKey: "travel_time",
    category: "geo",
    computeNormalized: (raw) => {
      const m = raw.travelTimeMin;
      let n = 0.55;
      if (m != null) {
        if (m <= 15) n = 1;
        else if (m <= 30) n = 0.8;
        else if (m <= 60) n = 0.55;
        else n = 0.25;
      }
      return { rawValue: m ?? -1, normalizedValue: n };
    },
  },
  {
    signalKey: "availability",
    category: "availability",
    computeNormalized: (raw) => ({
      rawValue: raw.acceptingRequests && !raw.vacationMode && !raw.pauseMode ? 1 : 0,
      normalizedValue:
        raw.acceptingRequests && !raw.vacationMode && !raw.pauseMode ? 1 : 0,
    }),
  },
  {
    signalKey: "workload",
    category: "availability",
    computeNormalized: (raw) => {
      const load =
        raw.maxDailyJobs > 0 ? raw.jobsToday / raw.maxDailyJobs : raw.workloadScore;
      return {
        rawValue: load,
        normalizedValue: clamp01(1 - load),
      };
    },
  },
  {
    signalKey: "reputation",
    category: "reputation",
    computeNormalized: (raw) => {
      const b = raw.reputationBoost ?? 0;
      return {
        rawValue: b,
        normalizedValue: clamp01(0.5 + b * 2.5),
      };
    },
  },
  {
    signalKey: "trust_level",
    category: "reputation",
    computeNormalized: (raw) => {
      const map: Record<string, number> = {
        excellent: 1,
        very_good: 0.85,
        good: 0.7,
        developing: 0.5,
        new_provider: 0.45,
        needs_attention: 0.2,
      };
      const n = map[raw.trustLevel ?? ""] ?? 0.5;
      return { rawValue: n, normalizedValue: n };
    },
  },
  {
    signalKey: "verification",
    category: "identity",
    computeNormalized: (raw) => ({
      rawValue: raw.verificationStatus === "verified" ? 1 : 0,
      normalizedValue: raw.verificationStatus === "verified" ? 1 : 0.35,
    }),
  },
  {
    signalKey: "category_expertise",
    category: "quality",
    computeNormalized: (raw) => ({
      rawValue: raw.categoryFit ? 1 : 0,
      normalizedValue: raw.categoryFit ? 1 : 0.2,
    }),
  },
  {
    signalKey: "experience",
    category: "quality",
    computeNormalized: (raw) => ({
      rawValue: raw.experienceProxy,
      normalizedValue: clamp01(raw.experienceProxy),
    }),
  },
  {
    signalKey: "completed_jobs",
    category: "behaviour",
    computeNormalized: (raw) => ({
      rawValue: raw.completedJobs,
      normalizedValue: clamp01(raw.completedJobs / 80),
    }),
  },
  {
    signalKey: "repeat_customers",
    category: "behaviour",
    computeNormalized: (raw) => ({
      rawValue: raw.repeatCustomerRate ?? 0.4,
      normalizedValue: clamp01(raw.repeatCustomerRate ?? 0.4),
    }),
  },
  {
    signalKey: "response_time",
    category: "behaviour",
    computeNormalized: (raw) => ({
      rawValue: raw.avgResponseHours ?? 12,
      normalizedValue:
        raw.avgResponseHours != null
          ? clamp01(1 - Math.min(raw.avgResponseHours, 48) / 48)
          : 0.5,
    }),
  },
  {
    signalKey: "acceptance_rate",
    category: "behaviour",
    computeNormalized: (raw) => ({
      rawValue: raw.acceptanceRate ?? 0.5,
      normalizedValue: clamp01(raw.acceptanceRate ?? 0.5),
    }),
  },
  {
    signalKey: "completion_rate",
    category: "behaviour",
    computeNormalized: (raw) => ({
      rawValue: raw.completionRate ?? 0.5,
      normalizedValue: clamp01(raw.completionRate ?? 0.5),
    }),
  },
  {
    signalKey: "cancellation_rate",
    category: "behaviour",
    computeNormalized: (raw) => ({
      rawValue: raw.cancellationRate ?? 0.1,
      // Higher cancellation → higher normalized; negative weight in engine
      normalizedValue: clamp01(raw.cancellationRate ?? 0.1),
    }),
  },
  {
    signalKey: "recommendation_rate",
    category: "behaviour",
    computeNormalized: (raw) => ({
      rawValue: raw.recommendationRate ?? 0.4,
      normalizedValue: clamp01(raw.recommendationRate ?? 0.4),
    }),
  },
  {
    signalKey: "review_quality",
    category: "quality",
    computeNormalized: (raw) => {
      const base = clamp01(raw.ratingAvg / 5);
      const volume = clamp01(raw.reviewCount / 40);
      return {
        rawValue: raw.ratingAvg,
        normalizedValue: clamp01(base * 0.75 + volume * 0.25),
      };
    },
  },
  {
    signalKey: "recent_activity",
    category: "availability",
    computeNormalized: (raw) => ({
      rawValue: raw.recentActivityScore,
      normalizedValue: clamp01(raw.recentActivityScore),
    }),
  },
  {
    signalKey: "business_hours",
    category: "availability",
    computeNormalized: (raw) => ({
      rawValue: raw.withinBusinessHours ? 1 : 0,
      normalizedValue: raw.withinBusinessHours ? 1 : 0.35,
    }),
  },
  {
    signalKey: "languages",
    category: "preference",
    computeNormalized: (raw) => ({
      rawValue: raw.languageFit,
      normalizedValue: clamp01(raw.languageFit),
    }),
  },
  {
    signalKey: "price_competitiveness",
    category: "price",
    computeNormalized: (raw) => ({
      rawValue: raw.priceCompetitiveness ?? 0.55,
      normalizedValue: clamp01(raw.priceCompetitiveness ?? 0.55),
    }),
  },
  {
    signalKey: "quality_cases",
    category: "risk",
    computeNormalized: (raw) => ({
      rawValue: raw.openQualityCases,
      normalizedValue: clamp01(raw.openQualityCases / 3),
    }),
  },
  {
    signalKey: "fraud_risk",
    category: "risk",
    computeNormalized: (raw) => ({
      rawValue: raw.fraudRisk01 ?? 0,
      normalizedValue: clamp01(raw.fraudRisk01 ?? 0),
    }),
  },
  {
    signalKey: "customer_preferences",
    category: "preference",
    computeNormalized: (raw) => ({
      rawValue: raw.preferenceFit,
      normalizedValue: clamp01(raw.preferenceFit),
    }),
  },
  {
    signalKey: "preferred_history",
    category: "preference",
    computeNormalized: (raw) => ({
      rawValue: raw.preferredHistory ? 1 : 0,
      normalizedValue: raw.preferredHistory ? 1 : 0,
    }),
  },
  {
    signalKey: "favourite_providers",
    category: "preference",
    computeNormalized: (raw) => ({
      rawValue: raw.isFavourite ? 1 : 0,
      normalizedValue: raw.isFavourite ? 1 : 0,
    }),
  },
  {
    signalKey: "fairness_exploration",
    category: "fairness",
    computeNormalized: (raw) => {
      // Engine applies fairness boost separately; collector returns cold-start hint
      const cold = raw.reviewCountForFairness < 8 ? 1 : 0.2;
      return { rawValue: raw.reviewCountForFairness, normalizedValue: cold };
    },
  },
];

export const ML_RANKER_COLLECTOR: MatchSignalCollector = {
  signalKey: "ml_ranker",
  category: "ml",
  computeNormalized: (raw) => {
    const v = raw.mlRankScore ?? 0;
    return {
      rawValue: v,
      normalizedValue: clamp01(v),
      metadata: { ml: true },
    };
  },
};
