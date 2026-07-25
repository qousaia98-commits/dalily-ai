import { createClient } from "@/lib/supabase/server";
import type { MatchReason } from "@/domains/matching/reasons";

export type MatchPoolSummary = {
  poolId: string;
  status: string;
  assignedCount: number;
  expandCount: number;
  initialCandidateCount: number;
};

export type MatchAssignmentView = {
  providerId: string;
  rank: number;
  source: string;
  reasons: MatchReason[];
  assignedAt: string;
};

export async function getMatchPoolSummaryForRequest(
  requestId: string,
): Promise<MatchPoolSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_pools")
    .select("id, status, assigned_count, expand_count, initial_candidate_count")
    .eq("service_request_id", requestId)
    .maybeSingle();

  if (!data) return null;
  return {
    poolId: data.id as string,
    status: data.status as string,
    assignedCount: Number(data.assigned_count ?? 0),
    expandCount: Number(data.expand_count ?? 0),
    initialCandidateCount: Number(data.initial_candidate_count ?? 0),
  };
}

export async function listMatchAssignmentsForRequest(
  requestId: string,
): Promise<MatchAssignmentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_assignments")
    .select("provider_id, rank_in_pool, source, reason_codes, assigned_at")
    .eq("service_request_id", requestId)
    .order("rank_in_pool", { ascending: true });

  return (data ?? []).map((row) => ({
    providerId: row.provider_id as string,
    rank: Number(row.rank_in_pool ?? 0),
    source: row.source as string,
    reasons: (row.reason_codes as MatchReason[]) ?? [],
    assignedAt: row.assigned_at as string,
  }));
}
