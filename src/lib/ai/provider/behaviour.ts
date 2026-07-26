import {
  fetchPerformanceScoresByProviderIds,
  type ProviderPerformanceRow,
} from "@/lib/search/learning";

export type ProviderBehaviourSignals = {
  providerId: string;
  acceptanceRate: number | null;
  avgResponseHours: number | null;
  cancellationRate: number | null;
  completionRate: number | null;
  avgRating: number | null;
  performanceScore: number;
  repeatCustomerRate: number | null;
  /** Preferred job type slugs from factors JSON when present. */
  preferredJobTypes: string[];
  sampleSize: number;
};

function preferredFromFactors(factors: Record<string, number>): string[] {
  return Object.entries(factors)
    .filter(([k, v]) => k.startsWith("job_type:") && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k.replace(/^job_type:/, ""));
}

/**
 * Provider behaviour signals for future matching (Phase 1 read-model).
 * Backed by Sprint 29 provider_performance_scores — no PII.
 */
export async function getProviderBehaviourSignals(
  providerIds: string[],
): Promise<Map<string, ProviderBehaviourSignals>> {
  const scores = await fetchPerformanceScoresByProviderIds(providerIds);
  const out = new Map<string, ProviderBehaviourSignals>();

  for (const [id, row] of scores) {
    out.set(id, toSignals(row));
  }
  return out;
}

function toSignals(row: ProviderPerformanceRow): ProviderBehaviourSignals {
  return {
    providerId: row.providerId,
    acceptanceRate: row.acceptanceRate,
    avgResponseHours: row.avgResponseHours,
    cancellationRate: row.cancellationRate,
    completionRate: row.completionRate,
    avgRating: row.avgRating,
    performanceScore: row.performanceScore,
    repeatCustomerRate: row.repeatCustomerRate,
    preferredJobTypes: preferredFromFactors(row.factors),
    sampleSize: row.sampleSize,
  };
}
