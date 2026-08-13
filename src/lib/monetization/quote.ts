/**
 * Sprint 6 Phase 1 — build pricing quote for a service request + persist history.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { calculateLeadUnlockPrice } from "./pricing";
import type { LeadPricingFactors, LeadPricingResult } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function inferLeadPricingFactors(
  serviceRequestId: string,
): Promise<LeadPricingFactors> {
  try {
    const { data: req } = await db()
      .from("service_requests")
      .select(
        "id, category_id, urgency, is_emergency, budget_max, budget_min, estimated_duration_hours, metadata, intent_text, description",
      )
      .eq("id", serviceRequestId)
      .maybeSingle();

    const { data: project } = await db()
      .from("service_projects")
      .select("id")
      .eq("root_service_request_id", serviceRequestId)
      .maybeSingle();

    let packageCount = 0;
    if (project?.id) {
      const { count } = await db()
        .from("project_packages")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id);
      packageCount = count ?? 0;
    }

    let categorySlug: string | null = null;
    if (req?.category_id) {
      const { data: cat } = await db()
        .from("categories")
        .select("slug")
        .eq("id", req.category_id)
        .maybeSingle();
      categorySlug = cat?.slug ? String(cat.slug) : null;
    }

    const urgencyRaw = String(req?.urgency ?? "normal").toLowerCase();
    const isEmergency = Boolean(req?.is_emergency) || urgencyRaw === "emergency";
    const urgency: LeadPricingFactors["urgency"] = isEmergency
      ? "emergency"
      : urgencyRaw === "high"
        ? "high"
        : urgencyRaw === "low"
          ? "low"
          : "normal";

    const budgetMax = Number(req?.budget_max ?? req?.budget_min ?? 150);
    const estimatedProjectValueUsd = Number.isFinite(budgetMax)
      ? Math.max(50, budgetMax)
      : 150;

    const duration = Number(req?.estimated_duration_hours ?? 3);
    const estimatedDurationHours = Number.isFinite(duration) ? duration : 3;

    const isMultiService = packageCount > 1;
    const complexity: LeadPricingFactors["complexity"] =
      packageCount >= 3 || estimatedDurationHours >= 12
        ? "high"
        : packageCount === 2 || estimatedDurationHours >= 5
          ? "medium"
          : "low";

    const meta = (req?.metadata as Record<string, unknown>) ?? {};
    const distanceKm =
      typeof meta.distance_km === "number" ? meta.distance_km : null;
    const demandLevel =
      meta.demand_level === "high" || meta.demand_level === "low"
        ? meta.demand_level
        : "normal";

    return {
      estimatedProjectValueUsd,
      categorySlug,
      urgency,
      isEmergency,
      isMultiService,
      complexity,
      estimatedDurationHours,
      distanceKm,
      demandLevel,
    };
  } catch {
    return {
      estimatedProjectValueUsd: 150,
      categorySlug: null,
      urgency: "normal",
      isEmergency: false,
      isMultiService: false,
      complexity: "medium",
      estimatedDurationHours: 3,
      distanceKm: null,
      demandLevel: "normal",
    };
  }
}

export async function quoteAndPersistLeadPrice(input: {
  serviceRequestId: string;
  providerId: string;
  unlockSessionId?: string | null;
}): Promise<LeadPricingResult & { pricingHistoryId: string | null }> {
  const factors = await inferLeadPricingFactors(input.serviceRequestId);
  const result = await calculateLeadUnlockPrice(factors);

  let pricingHistoryId: string | null = null;
  try {
    const { data } = await db()
      .from("lead_pricing_history")
      .insert({
        unlock_session_id: input.unlockSessionId ?? null,
        service_request_id: input.serviceRequestId,
        provider_id: input.providerId,
        ai_score: result.aiScore,
        base_price_usd: result.basePriceUsd,
        final_price_usd: result.finalPriceUsd,
        currency: result.currency,
        factors: result.factors,
        explanation_en: result.explanationEn,
        explanation_ar: result.explanationAr,
        estimated_project_value_usd: result.estimatedProjectValueUsd,
        estimated_duration_hours: result.estimatedDurationHours,
        potential_revenue_usd: result.potentialRevenueUsd,
      })
      .select("id")
      .single();
    pricingHistoryId = data?.id ? String(data.id) : null;
  } catch {
    // soft
  }

  void emitAiLearningEvent({
    eventType: "lead_price_calculated",
    providerId: input.providerId,
    serviceRequestId: input.serviceRequestId,
    metadata: {
      anonymized: true,
      finalPriceUsd: result.finalPriceUsd,
      aiScore: result.aiScore,
    },
  });

  return { ...result, pricingHistoryId };
}
