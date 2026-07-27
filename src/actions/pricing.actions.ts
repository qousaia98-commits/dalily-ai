"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser, requireAuthUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiDynamicPricingEnabled } from "@/lib/config/feature-flags";
import {
  getPricingHistoryReplay,
  recommendPrice,
  refreshMarketDataSnapshot,
  simulatePricing,
  toPublicPriceRecommendation,
  updatePricingWeight,
  recordPricingFeedback,
} from "@/lib/pricing-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProvider } from "@/lib/providers/database";

export type PricingActionState = {
  success: boolean;
  error?: string;
  recommendation?: {
    suggestedMin: number;
    suggestedAvg: number;
    suggestedPremium: number;
    currency: string;
    confidence: number;
    marketPosition: string;
    explanations: Array<{ code: string; labelEn: string }>;
    algorithmVersion: string;
  };
  simulation?: {
    latencyMs: number;
    public: {
      suggestedMin: number;
      suggestedAvg: number;
      suggestedPremium: number;
      confidence: number;
      marketPosition: string;
      explanations: Array<{ code: string; labelEn: string }>;
    };
    signalCount?: number;
  };
  replay?: Awaited<ReturnType<typeof getPricingHistoryReplay>>;
};

function disabled(): PricingActionState {
  return { success: false, error: "feature_disabled" };
}

async function requirePricingAdmin() {
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  return admin;
}

export async function updatePricingWeightAction(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<PricingActionState> {
  if (!isAiDynamicPricingEnabled()) return disabled();
  await requirePricingAdmin();
  const ok = await updatePricingWeight(input);
  if (!ok) return { success: false, error: "update_failed" };
  revalidatePath("/admin/pricing", "layout");
  return { success: true };
}

export async function simulatePricingAction(input: {
  categoryKey: string;
  regionKey?: string;
  distanceKm?: number;
  urgency01?: number;
  largeProject?: boolean;
  complexity01?: number;
}): Promise<PricingActionState> {
  if (!isAiDynamicPricingEnabled()) return disabled();
  await requirePricingAdmin();
  if (!input.categoryKey.trim()) {
    return { success: false, error: "validation_error" };
  }

  const result = await simulatePricing({
    categoryKey: input.categoryKey.trim(),
    regionKey: input.regionKey ?? "all",
    distanceKm: input.distanceKm ?? null,
    urgency01: input.urgency01 ?? 0.2,
    largeProject: input.largeProject ?? false,
    complexity01: input.complexity01 ?? 0.4,
  });

  if (!result) return { success: false, error: "simulate_failed" };

  return {
    success: true,
    simulation: {
      latencyMs: result.latencyMs,
      public: {
        suggestedMin: result.public.suggestedMin,
        suggestedAvg: result.public.suggestedAvg,
        suggestedPremium: result.public.suggestedPremium,
        confidence: result.public.confidence,
        marketPosition: result.public.marketPosition,
        explanations: result.public.explanations.map((e) => ({
          code: e.code,
          labelEn: e.labelEn,
        })),
      },
      signalCount: result.internalSignals,
    },
  };
}

export async function setPricingExperimentAction(input: {
  active: boolean;
  trafficBPct: number;
}): Promise<PricingActionState> {
  if (!isAiDynamicPricingEnabled()) return disabled();
  await requirePricingAdmin();
  try {
    const admin = createAdminClient();
    await admin
      .from("pricing_experiments")
      .update({
        active: input.active,
        traffic_b_pct: Math.max(0, Math.min(100, input.trafficBPct)),
        updated_at: new Date().toISOString(),
      })
      .eq("experiment_key", "pricing_default");
    revalidatePath("/admin/pricing", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "update_failed" };
  }
}

export async function refreshPricingMarketAction(): Promise<PricingActionState> {
  if (!isAiDynamicPricingEnabled()) return disabled();
  await requirePricingAdmin();
  await refreshMarketDataSnapshot({ categoryKey: "general", regionKey: "all" });
  revalidatePath("/admin/pricing", "layout");
  return { success: true };
}

export async function replayPricingHistoryAction(input: {
  historyId: string;
}): Promise<PricingActionState> {
  if (!isAiDynamicPricingEnabled()) return disabled();
  await requirePricingAdmin();
  const replay = await getPricingHistoryReplay(input.historyId);
  if (!replay) return { success: false, error: "not_found" };
  return { success: true, replay };
}

/** Provider-facing recommendation (public fields only). */
export async function getProviderPriceRecommendationAction(input: {
  categoryKey: string;
  distanceKm?: number;
}): Promise<PricingActionState> {
  if (!isAiDynamicPricingEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };

  const computation = await recommendPrice({
    categoryKey: input.categoryKey,
    distanceKm: input.distanceKm ?? null,
    providerId: provider.id,
    persist: true,
  });
  if (!computation) return { success: false, error: "recommend_failed" };

  const pub = toPublicPriceRecommendation(computation);
  return {
    success: true,
    recommendation: {
      ...pub,
      explanations: pub.explanations.map((e) => ({
        code: e.code,
        labelEn: e.labelEn,
      })),
    },
  };
}

export async function recordProviderPricingFeedbackAction(input: {
  offeredPrice: number;
  accepted?: boolean;
  suggestedMin?: number;
  suggestedPremium?: number;
}): Promise<PricingActionState> {
  if (!isAiDynamicPricingEnabled()) return disabled();
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { success: false, error: "no_provider" };

  await recordPricingFeedback({
    providerId: provider.id,
    offeredPrice: input.offeredPrice,
    accepted: input.accepted ?? null,
    suggestedMin: input.suggestedMin,
    suggestedPremium: input.suggestedPremium,
  });
  revalidatePath("/business/pricing", "layout");
  return { success: true };
}
