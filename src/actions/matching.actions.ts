"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isSmartMatchingEngineEnabled } from "@/lib/config/feature-flags";
import {
  simulateMatching,
  updateMatchingWeight,
} from "@/lib/matching-engine/service";
import { createAdminClient } from "@/lib/supabase/admin";

export type MatchingActionState = {
  success: boolean;
  error?: string;
  simulation?: {
    latencyMs: number;
    publicView: Array<{
      providerId: string;
      rank: number;
      explanations: Array<{ code: string; labelEn: string }>;
    }>;
    topInternalScores?: number[];
  };
};

function disabled(): MatchingActionState {
  return { success: false, error: "feature_disabled" };
}

async function requireMatchingAdmin() {
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  return admin;
}

export async function updateMatchingWeightAction(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<MatchingActionState> {
  if (!isSmartMatchingEngineEnabled()) return disabled();
  await requireMatchingAdmin();
  const ok = await updateMatchingWeight(input);
  if (!ok) return { success: false, error: "update_failed" };
  revalidatePath("/admin/matching", "layout");
  return { success: true };
}

export async function simulateMatchingAction(input: {
  providerIds: string[];
}): Promise<MatchingActionState> {
  if (!isSmartMatchingEngineEnabled()) return disabled();
  await requireMatchingAdmin();
  if (!input.providerIds.length) {
    return { success: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: providers } = await (admin as any)
    .from("providers")
    .select("id, rating_avg, review_count, verification_status")
    .in("id", input.providerIds.slice(0, 20));

  const result = await simulateMatching({
    candidates: (providers ?? []).map(
      (p: {
        id: string;
        rating_avg: number | null;
        review_count: number | null;
        verification_status: string | null;
      }) => ({
        providerId: p.id,
        ratingAvg: Number(p.rating_avg ?? 0),
        reviewCount: Number(p.review_count ?? 0),
        verificationStatus: String(p.verification_status ?? "unverified"),
        categoryFit: true,
        acceptingRequests: true,
      }),
    ),
  });

  return {
    success: true,
    simulation: {
      latencyMs: result.latencyMs,
      publicView: result.publicView.map((p) => ({
        providerId: p.providerId,
        rank: p.rank,
        explanations: p.explanations.map((e) => ({
          code: e.code,
          labelEn: e.labelEn,
        })),
      })),
      // Admin-only peek for simulation diagnostics
      topInternalScores: result.ranked.slice(0, 5).map((r) => r.internalScore),
    },
  };
}

export async function setMatchingExperimentAction(input: {
  active: boolean;
  trafficBPct: number;
}): Promise<MatchingActionState> {
  if (!isSmartMatchingEngineEnabled()) return disabled();
  await requireMatchingAdmin();
  try {
    const admin = createAdminClient();
    await admin
      .from("matching_experiments")
      .update({
        active: input.active,
        traffic_b_pct: Math.max(0, Math.min(100, input.trafficBPct)),
        updated_at: new Date().toISOString(),
      })
      .eq("experiment_key", "smart_match_default");
    revalidatePath("/admin/matching", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "update_failed" };
  }
}
