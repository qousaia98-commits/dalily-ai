"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser, requireAuthUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiBusinessAssistantEnabled } from "@/lib/config/feature-flags";
import {
  decideRecommendation,
  upsertBusinessGoal,
  type BusinessGoalType,
} from "@/lib/business-assistant";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProvider } from "@/lib/providers/database";

export type BusinessAssistantActionState = {
  success: boolean;
  error?: string;
};

function disabled(): BusinessAssistantActionState {
  return { success: false, error: "feature_disabled" };
}

export async function acceptBusinessRecommendationAction(input: {
  recommendationId: string;
}): Promise<BusinessAssistantActionState> {
  if (!isAiBusinessAssistantEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };
  const ok = await decideRecommendation({
    recommendationId: input.recommendationId,
    providerId: provider.id,
    accept: true,
  });
  revalidatePath("/business/assistant", "layout");
  return ok ? { success: true } : { success: false, error: "update_failed" };
}

export async function dismissBusinessRecommendationAction(input: {
  recommendationId: string;
}): Promise<BusinessAssistantActionState> {
  if (!isAiBusinessAssistantEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };
  const ok = await decideRecommendation({
    recommendationId: input.recommendationId,
    providerId: provider.id,
    accept: false,
  });
  revalidatePath("/business/assistant", "layout");
  return ok ? { success: true } : { success: false, error: "update_failed" };
}

export async function upsertBusinessGoalAction(input: {
  goalType: BusinessGoalType;
  title: string;
  targetValue: number;
  currentValue?: number;
  unit?: string;
  period?: string;
}): Promise<BusinessAssistantActionState> {
  if (!isAiBusinessAssistantEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };
  if (!input.title.trim() || !Number.isFinite(input.targetValue)) {
    return { success: false, error: "validation_error" };
  }
  const goal = await upsertBusinessGoal({
    providerId: provider.id,
    goalType: input.goalType,
    title: input.title.trim(),
    targetValue: input.targetValue,
    currentValue: input.currentValue,
    unit: input.unit,
    period: input.period,
  });
  revalidatePath("/business/assistant", "layout");
  return goal ? { success: true } : { success: false, error: "update_failed" };
}

export async function setBusinessAssistantExperimentAction(input: {
  active: boolean;
  trafficBPct: number;
}): Promise<BusinessAssistantActionState> {
  if (!isAiBusinessAssistantEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  try {
    const client = createAdminClient();
    await client
      .from("business_assistant_experiments")
      .update({
        active: input.active,
        traffic_b_pct: Math.max(0, Math.min(100, input.trafficBPct)),
        updated_at: new Date().toISOString(),
      })
      .eq("experiment_key", "business_assistant_default");
    revalidatePath("/admin/business-assistant", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "update_failed" };
  }
}
