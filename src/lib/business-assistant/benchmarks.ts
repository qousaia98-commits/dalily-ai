/**
 * Anonymous benchmarking — never exposes competitor identities.
 */

import type { CollectedBusinessRaw } from "@/lib/business-assistant/collect";
import type { BusinessBenchmark, BusinessCohort } from "@/lib/business-assistant/types";

export function computeAnonymousBenchmark(
  raw: CollectedBusinessRaw,
): BusinessBenchmark {
  const score = raw.businessHealthScore;
  let cohort: BusinessCohort = "average";
  let percentile = 50;

  if (score >= 0.82) {
    cohort = "top_20";
    percentile = 85;
  } else if (score >= 0.68) {
    cohort = "above_average";
    percentile = 70;
  } else if (score >= 0.45) {
    cohort = "average";
    percentile = 50;
  } else if (raw.reputationTrend === "rising") {
    cohort = "improving";
    percentile = 40;
  } else {
    cohort = "below_average";
    percentile = 25;
  }

  return {
    cohort,
    percentile,
    regionKey: "all",
    categoryKey: raw.topCategory ?? "all",
  };
}
