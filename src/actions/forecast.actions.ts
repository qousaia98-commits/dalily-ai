"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser, requireAuthUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isForecastEngineEnabled } from "@/lib/config/feature-flags";
import {
  getForecastHistoryReplay,
  getCustomerDemandHint,
  recordForecastAccuracy,
  refreshForecastMarketSnapshot,
  simulateForecast,
  updateForecastWeight,
  acceptForecastInsight,
  type ForecastHorizon,
} from "@/domains/forecast";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProvider } from "@/lib/providers/database";

export type ForecastActionState = {
  success: boolean;
  error?: string;
  simulation?: {
    latencyMs: number;
    public: {
      horizon: string;
      expectedDemand: number;
      confidence: number;
      trend: string;
      recommendedCapacity: number;
      explanations: Array<{ code: string; labelEn: string }>;
    };
    signalCount?: number;
  };
  replay?: Awaited<ReturnType<typeof getForecastHistoryReplay>>;
  customerHint?: Awaited<ReturnType<typeof getCustomerDemandHint>>;
};

function disabled(): ForecastActionState {
  return { success: false, error: "feature_disabled" };
}

async function requireForecastAdmin() {
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  return admin;
}

export async function updateForecastWeightAction(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  await requireForecastAdmin();
  const ok = await updateForecastWeight(input);
  if (!ok) return { success: false, error: "update_failed" };
  revalidatePath("/admin/forecast", "layout");
  return { success: true };
}

export async function simulateForecastAction(input: {
  categoryKey: string;
  regionKey?: string;
  horizon?: ForecastHorizon;
}): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  await requireForecastAdmin();
  if (!input.categoryKey.trim()) {
    return { success: false, error: "validation_error" };
  }

  const result = await simulateForecast({
    categoryKey: input.categoryKey.trim(),
    regionKey: input.regionKey ?? "all",
    horizon: input.horizon ?? "7d",
  });
  if (!result) return { success: false, error: "simulate_failed" };

  return {
    success: true,
    simulation: {
      latencyMs: result.latencyMs,
      public: {
        horizon: result.public.horizon,
        expectedDemand: result.public.expectedDemand,
        confidence: result.public.confidence,
        trend: result.public.trend,
        recommendedCapacity: result.public.recommendedCapacity,
        explanations: result.public.explanations.map((e) => ({
          code: e.code,
          labelEn: e.labelEn,
        })),
      },
      signalCount: result.signalCount,
    },
  };
}

export async function setForecastExperimentAction(input: {
  active: boolean;
  trafficBPct: number;
}): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  await requireForecastAdmin();
  try {
    const admin = createAdminClient();
    await admin
      .from("forecast_experiments")
      .update({
        active: input.active,
        traffic_b_pct: Math.max(0, Math.min(100, input.trafficBPct)),
        updated_at: new Date().toISOString(),
      })
      .eq("experiment_key", "forecast_default");
    revalidatePath("/admin/forecast", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "update_failed" };
  }
}

export async function refreshForecastMarketAction(): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  await requireForecastAdmin();
  await refreshForecastMarketSnapshot({
    categoryKey: "general",
    regionKey: "all",
  });
  revalidatePath("/admin/forecast", "layout");
  return { success: true };
}

export async function replayForecastHistoryAction(input: {
  historyId: string;
}): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  await requireForecastAdmin();
  const replay = await getForecastHistoryReplay(input.historyId);
  if (!replay) return { success: false, error: "not_found" };
  return { success: true, replay };
}

export async function evaluateForecastAccuracyAction(input: {
  historyId?: string;
  horizon: ForecastHorizon;
  predictedDemand: number;
  actualDemand: number;
  modelKey?: string;
}): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  await requireForecastAdmin();
  await recordForecastAccuracy(input);
  revalidatePath("/admin/forecast", "layout");
  return { success: true };
}

export async function acceptProviderForecastAction(input: {
  horizon: ForecastHorizon;
}): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };
  await acceptForecastInsight({
    providerId: provider.id,
    horizon: input.horizon,
  });
  return { success: true };
}

export async function getCustomerDemandHintAction(input?: {
  categoryKey?: string;
}): Promise<ForecastActionState> {
  if (!isForecastEngineEnabled()) return disabled();
  await requireAuthUser();
  const hint = await getCustomerDemandHint({
    categoryKey: input?.categoryKey ?? "general",
  });
  return { success: true, customerHint: hint };
}
