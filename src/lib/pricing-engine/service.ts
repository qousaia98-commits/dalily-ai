/**
 * Pricing service — recommend, persist, feedback, experiments.
 * Final price always decided by the provider.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectPricingRaw,
  invalidatePricingMarketCache,
  type PriceRecommendInput,
} from "@/lib/pricing-engine/collect";
import { computePriceFromSignals } from "@/lib/pricing-engine/engine";
import { trackPricingEvent } from "@/lib/pricing-engine/observability";
import {
  DEFAULT_PRICING_WEIGHTS,
  mergePricingWeights,
} from "@/lib/pricing-engine/weights";
import { isAiDynamicPricingEnabled } from "@/lib/config/feature-flags";
import {
  PRICING_MODEL_VERSION,
  type PricingComputation,
  type PricingWeight,
  type ProviderPricingInsights,
  type PublicPriceRecommendation,
} from "@/lib/pricing-engine/types";
import type { Json } from "@/types/database.types";

async function loadWeights(): Promise<PricingWeight[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("pricing_weights").select("*");
    if (!data?.length) return DEFAULT_PRICING_WEIGHTS;
    return mergePricingWeights(
      DEFAULT_PRICING_WEIGHTS,
      data.map((r) => ({
        signalKey: r.signal_key,
        category: r.category,
        weight: Number(r.weight),
        enabled: r.enabled,
        mlReady: r.ml_ready,
        description: r.description,
      })),
    );
  } catch {
    return DEFAULT_PRICING_WEIGHTS;
  }
}

async function resolveExperiment(salt?: string | null): Promise<{
  algorithm: string;
  experimentId: string | null;
}> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("pricing_experiments")
      .select("*")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!data) {
      return { algorithm: PRICING_MODEL_VERSION, experimentId: null };
    }
    const pct = Number(data.traffic_b_pct ?? 0);
    let bucket = 0;
    const key = salt ?? "anon";
    for (let i = 0; i < key.length; i++) bucket = (bucket + key.charCodeAt(i)) % 100;
    const useB = bucket < pct;
    return {
      algorithm: useB ? data.algorithm_b : data.algorithm_a,
      experimentId: data.experiment_key,
    };
  } catch {
    return { algorithm: PRICING_MODEL_VERSION, experimentId: null };
  }
}

export async function recommendPrice(
  input: PriceRecommendInput & {
    providerId?: string | null;
    customerId?: string | null;
    requestId?: string | null;
    persist?: boolean;
  },
): Promise<PricingComputation | null> {
  if (!isAiDynamicPricingEnabled()) return null;
  const started = Date.now();
  const weights = await loadWeights();
  const experiment = await resolveExperiment(
    input.requestId ?? input.providerId ?? input.customerId,
  );
  const raw = await collectPricingRaw(input);
  const computation = computePriceFromSignals({
    raw,
    weights,
    experimentId: experiment.experimentId,
    startedAt: started,
    includeMlLayer: experiment.algorithm.includes("ml"),
  });

  void trackPricingEvent("pricing_calculated", {
    latencyMs: computation.latencyMs,
    algorithmVersion: computation.algorithmVersion,
    categoryKey: computation.categoryKey,
    providerId: input.providerId,
  });
  void trackPricingEvent("latency", { latencyMs: computation.latencyMs });

  if (input.persist !== false) {
    void persistRecommendation({
      computation,
      providerId: input.providerId,
      customerId: input.customerId,
      requestId: input.requestId,
    });
  }

  return computation;
}

async function persistRecommendation(input: {
  computation: PricingComputation;
  providerId?: string | null;
  customerId?: string | null;
  requestId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const c = input.computation;
    const { data: hist } = await admin
      .from("pricing_history")
      .insert({
        request_id: input.requestId ?? null,
        provider_id: input.providerId ?? null,
        customer_id: input.customerId ?? null,
        category_key: c.categoryKey,
        region_key: c.regionKey,
        currency: c.currency,
        suggested_min: c.suggestedMin,
        suggested_avg: c.suggestedAvg,
        suggested_premium: c.suggestedPremium,
        confidence: c.confidence,
        market_position: c.marketPosition,
        signal_breakdown: Object.fromEntries(
          c.signals.map((s) => [s.signalKey, s.contribution]),
        ) as Json,
        algorithm_version: c.algorithmVersion,
        experiment_id: c.experimentId,
        latency_ms: c.latencyMs,
      })
      .select("id")
      .single();

    if (hist?.id && c.explanations.length) {
      await admin.from("pricing_explanations").insert(
        c.explanations.map((e) => ({
          history_id: hist.id,
          code: e.code,
          label_en: e.labelEn,
          label_ar: e.labelAr ?? null,
        })),
      );
    }
  } catch {
    /* soft until migration */
  }
}

export function toPublicPriceRecommendation(
  c: PricingComputation,
): PublicPriceRecommendation {
  return {
    suggestedMin: c.suggestedMin,
    suggestedAvg: c.suggestedAvg,
    suggestedPremium: c.suggestedPremium,
    currency: c.currency,
    confidence: c.confidence,
    marketPosition: c.marketPosition,
    explanations: c.explanations,
    algorithmVersion: c.algorithmVersion,
  };
}

export async function recordPricingFeedback(input: {
  historyId?: string | null;
  providerId?: string | null;
  customerId?: string | null;
  offeredPrice: number;
  accepted?: boolean | null;
  completed?: boolean | null;
  suggestedMin?: number;
  suggestedPremium?: number;
}): Promise<void> {
  if (!isAiDynamicPricingEnabled()) return;
  try {
    const within =
      input.suggestedMin != null &&
      input.suggestedPremium != null &&
      input.offeredPrice >= input.suggestedMin &&
      input.offeredPrice <= input.suggestedPremium;

    const admin = createAdminClient();
    await admin.from("pricing_feedback").insert({
      history_id: input.historyId ?? null,
      provider_id: input.providerId ?? null,
      customer_id: input.customerId ?? null,
      offered_price: input.offeredPrice,
      accepted: input.accepted ?? null,
      completed: input.completed ?? null,
      within_suggested_range: within,
    });

    if (input.accepted) {
      void trackPricingEvent("offer_accepted", {
        providerId: input.providerId,
        offeredPrice: input.offeredPrice,
      });
    } else {
      void trackPricingEvent("provider_price_set", {
        providerId: input.providerId,
        offeredPrice: input.offeredPrice,
      });
    }
  } catch {
    /* soft */
  }
}

export async function getProviderPricingInsights(input: {
  providerId: string;
  categoryKey?: string;
}): Promise<ProviderPricingInsights> {
  const empty: ProviderPricingInsights = {
    suggested: null,
    marketAverage: null,
    pastAcceptedAvg: null,
    acceptanceRate: null,
    revenueTrendPct: null,
    competitiveness: "unknown",
    recommendations: [],
    currency: "SYP",
  };
  if (!isAiDynamicPricingEnabled()) return empty;

  const computation = await recommendPrice({
    categoryKey: input.categoryKey ?? "general",
    providerId: input.providerId,
    persist: false,
  });

  let pastAcceptedAvg: number | null = null;
  let acceptanceRate: number | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("pricing_feedback")
      .select("offered_price, accepted")
      .eq("provider_id", input.providerId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = data ?? [];
    const accepted = rows.filter((r) => r.accepted && r.offered_price != null);
    if (accepted.length) {
      pastAcceptedAvg =
        Math.round(
          accepted.reduce((a, b) => a + Number(b.offered_price), 0) /
            accepted.length,
        );
    }
    if (rows.length) {
      acceptanceRate =
        Math.round(
          (rows.filter((r) => r.accepted).length / rows.length) * 1000,
        ) / 1000;
    }
  } catch {
    /* optional */
  }

  const suggested = computation
    ? toPublicPriceRecommendation(computation)
    : null;
  const marketAverage = computation?.suggestedAvg ?? null;

  let competitiveness: ProviderPricingInsights["competitiveness"] = "unknown";
  if (pastAcceptedAvg != null && marketAverage != null) {
    if (pastAcceptedAvg < marketAverage * 0.92) competitiveness = "below";
    else if (pastAcceptedAvg > marketAverage * 1.08) competitiveness = "above";
    else competitiveness = "at";
  }

  const recommendations: string[] = [];
  if (competitiveness === "below") {
    recommendations.push(
      "Your recent accepted prices sit below the market average — consider testing a fair-range quote.",
    );
  } else if (competitiveness === "above") {
    recommendations.push(
      "You price above market — emphasize verification, speed, and quality in the offer pitch.",
    );
  } else {
    recommendations.push(
      "Stay within the suggested min–premium band for competitive win rates.",
    );
  }
  if (acceptanceRate != null && acceptanceRate < 0.4) {
    recommendations.push(
      "Acceptance rate is low — try closer to the suggested average.",
    );
  }

  return {
    suggested,
    marketAverage,
    pastAcceptedAvg,
    acceptanceRate,
    revenueTrendPct: null,
    competitiveness,
    recommendations,
    currency: suggested?.currency ?? "SYP",
  };
}

export async function updatePricingWeight(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<boolean> {
  if (!isAiDynamicPricingEnabled()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("pricing_weights")
      .update({
        weight: input.weight,
        enabled: input.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("signal_key", input.signalKey);
    return !error;
  } catch {
    return false;
  }
}

export async function refreshMarketDataSnapshot(input?: {
  categoryKey?: string;
  regionKey?: string;
}): Promise<void> {
  if (!isAiDynamicPricingEnabled()) return;
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: offers } = await (admin as any)
      .from("marketplace_offers")
      .select("price, currency")
      .not("price", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    const prices = (offers ?? [])
      .map((o: { price: number }) => Number(o.price))
      .filter((n: number) => n > 0)
      .sort((a: number, b: number) => a - b);
    if (prices.length < 3) return;
    const avg =
      prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p50 = prices[Math.floor(prices.length * 0.5)];
    const p75 = prices[Math.floor(prices.length * 0.75)];
    await admin.from("pricing_market_data").upsert(
      {
        category_key: input?.categoryKey ?? "general",
        region_key: input?.regionKey ?? "all",
        currency: "SYP",
        sample_count: prices.length,
        avg_price: Math.round(avg),
        p25_price: p25,
        p50_price: p50,
        p75_price: p75,
        min_price: prices[0],
        max_price: prices[prices.length - 1],
        demand_index: 0.55,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "category_key,region_key,currency" },
    );
    invalidatePricingMarketCache();
  } catch {
    /* soft */
  }
}

export async function simulatePricing(
  input: PriceRecommendInput,
): Promise<{ public: PublicPriceRecommendation; latencyMs: number; internalSignals?: number } | null> {
  const c = await recommendPrice({ ...input, persist: false });
  if (!c) return null;
  return {
    public: toPublicPriceRecommendation(c),
    latencyMs: c.latencyMs,
    internalSignals: c.signals.length,
  };
}
