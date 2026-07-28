/**
 * Pure view / DTO types for matching UI — no server imports.
 */

import type { MatchReason } from "@/domains/matching/reasons";
import type { MatchWeight } from "@/lib/matching-engine/types";

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

/** Admin matching center DTO — kept free of server-only modules for client props. */
export type AdminMatchingDashboard = {
  weights: MatchWeight[];
  recentHistory: Array<{
    id: string;
    requestId: string | null;
    algorithmVersion: string;
    latencyMs: number | null;
    providerCount: number;
    createdAt: string;
  }>;
  feedbackStats: {
    total: number;
    accepted: number;
    completed: number;
    complaints: number;
    repeats: number;
  };
  avgLatencyMs: number | null;
  experiment: {
    key: string;
    active: boolean;
    algorithmA: string;
    algorithmB: string;
    trafficBPct: number;
  } | null;
  modelVersion: string;
};
