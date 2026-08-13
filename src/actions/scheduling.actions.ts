"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser, requireAuthUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiSchedulingEnabled } from "@/lib/config/feature-flags";
import {
  decideOpportunity,
  decideScheduleRecommendation,
  getScheduleHistoryReplay,
  simulateSchedule,
  updateScheduleWeight,
} from "@/lib/scheduling-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProvider } from "@/lib/providers/database";

export type ScheduleActionState = {
  success: boolean;
  error?: string;
  simulation?: {
    latencyMs: number;
    utilization: number;
    travelMinutes: number;
    idleMinutes: number;
    gaps: number;
    opportunities: number;
    explanations: Array<{ code: string; labelEn: string }>;
  };
  replay?: Awaited<ReturnType<typeof getScheduleHistoryReplay>>;
};

function disabled(): ScheduleActionState {
  return { success: false, error: "feature_disabled" };
}

async function requireScheduleAdmin() {
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  return admin;
}

export async function updateScheduleWeightAction(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<ScheduleActionState> {
  if (!isAiSchedulingEnabled()) return disabled();
  await requireScheduleAdmin();
  const ok = await updateScheduleWeight(input);
  if (!ok) return { success: false, error: "update_failed" };
  revalidatePath("/admin/scheduling", "layout");
  return { success: true };
}

export async function simulateScheduleAction(input: {
  providerId: string;
}): Promise<ScheduleActionState> {
  if (!isAiSchedulingEnabled()) return disabled();
  await requireScheduleAdmin();
  if (!input.providerId.trim()) return { success: false, error: "validation_error" };

  const result = await simulateSchedule({ providerId: input.providerId.trim() });
  if (!result) return { success: false, error: "simulate_failed" };

  return {
    success: true,
    simulation: {
      latencyMs: result.latencyMs,
      utilization: result.public.dailyUtilization,
      travelMinutes: result.public.travelMinutes,
      idleMinutes: result.public.idleMinutes,
      gaps: result.gaps,
      opportunities: result.opportunities,
      explanations: result.public.explanations.map((e) => ({
        code: e.code,
        labelEn: e.labelEn,
      })),
    },
  };
}

export async function setScheduleExperimentAction(input: {
  active: boolean;
  trafficBPct: number;
}): Promise<ScheduleActionState> {
  if (!isAiSchedulingEnabled()) return disabled();
  await requireScheduleAdmin();
  try {
    const admin = createAdminClient();
    await admin
      .from("schedule_experiments")
      .update({
        active: input.active,
        traffic_b_pct: Math.max(0, Math.min(100, input.trafficBPct)),
        updated_at: new Date().toISOString(),
      })
      .eq("experiment_key", "schedule_default");
    revalidatePath("/admin/scheduling", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "update_failed" };
  }
}

export async function replayScheduleHistoryAction(input: {
  historyId: string;
}): Promise<ScheduleActionState> {
  if (!isAiSchedulingEnabled()) return disabled();
  await requireScheduleAdmin();
  const replay = await getScheduleHistoryReplay(input.historyId);
  if (!replay) return { success: false, error: "not_found" };
  return { success: true, replay };
}

export async function acceptOpportunityAction(input: {
  opportunityId: string;
}): Promise<ScheduleActionState> {
  if (!isAiSchedulingEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };
  const ok = await decideOpportunity({
    opportunityId: input.opportunityId,
    providerId: provider.id,
    accept: true,
  });
  revalidatePath("/business/scheduling", "layout");
  return ok ? { success: true } : { success: false, error: "update_failed" };
}

export async function ignoreOpportunityAction(input: {
  opportunityId: string;
}): Promise<ScheduleActionState> {
  if (!isAiSchedulingEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };
  const ok = await decideOpportunity({
    opportunityId: input.opportunityId,
    providerId: provider.id,
    accept: false,
  });
  revalidatePath("/business/scheduling", "layout");
  return ok ? { success: true } : { success: false, error: "update_failed" };
}

export async function decideRecommendationAction(input: {
  recommendationId: string;
  accept: boolean;
}): Promise<ScheduleActionState> {
  if (!isAiSchedulingEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };
  const ok = await decideScheduleRecommendation({
    recommendationId: input.recommendationId,
    providerId: provider.id,
    accept: input.accept,
  });
  revalidatePath("/business/scheduling", "layout");
  return ok ? { success: true } : { success: false, error: "update_failed" };
}
