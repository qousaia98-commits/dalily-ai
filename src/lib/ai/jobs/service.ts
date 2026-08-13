import { analyzeJob } from "@/lib/ai/jobs/analyze";
import { buildProviderPrepSummary } from "@/lib/ai/jobs/preparation";
import {
  getLatestJobAnalysisForRequest,
  persistJobAnalysis,
} from "@/lib/ai/jobs/repository";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { JobAnalysis, ProviderPrepSummary } from "@/lib/ai/jobs/types";
import {
  isAiEngineV4Enabled,
  isAiEngineV5Enabled,
} from "@/lib/config/feature-flags";

/**
 * Analyze a request and cache the result for provider prep.
 */
export async function analyzeAndStoreJob(input: {
  text: string;
  serviceRequestId?: string | null;
  categorySlug?: string | null;
  emergency?: boolean;
}): Promise<JobAnalysis | null> {
  if (!isAiEngineV4Enabled()) return null;

  const analysis = analyzeJob({
    text: input.text,
    categorySlug: input.categorySlug,
    emergency: input.emergency,
  });
  if (!analysis) return null;

  if (input.serviceRequestId) {
    void persistJobAnalysis({
      serviceRequestId: input.serviceRequestId,
      analysis,
    });
  }
  return analysis;
}

/**
 * Load or compute provider preparation summary for an opportunity.
 */
export async function getProviderPrepForRequest(input: {
  serviceRequestId: string;
  intentText: string | null;
  categorySlug?: string | null;
  urgency?: string | null;
  locale?: "en" | "ar";
}): Promise<ProviderPrepSummary | null> {
  if (!isAiEngineV4Enabled()) return null;

  let analysis =
    (await getLatestJobAnalysisForRequest(input.serviceRequestId)) ?? null;

  if (!analysis && input.intentText) {
    analysis = await analyzeAndStoreJob({
      text: input.intentText,
      serviceRequestId: input.serviceRequestId,
      categorySlug: input.categorySlug,
      emergency: input.urgency === "emergency",
    });
  }

  if (!analysis) return null;

  // Sprint 8 Phase 2 — enrich catalog price with live market recommendation
  try {
    const { isAiDynamicPricingEnabled } = await import(
      "@/lib/config/feature-flags"
    );
    if (isAiDynamicPricingEnabled()) {
      const { recommendPrice } = await import("@/lib/pricing-engine/service");
      const computation = await recommendPrice({
        categoryKey: analysis.categorySlug || analysis.serviceKey || "general",
        catalogMin: analysis.price.min,
        catalogTypical: analysis.price.typical,
        catalogMax: analysis.price.max,
        currency: analysis.price.currency,
        urgency01: input.urgency === "emergency" ? 0.9 : 0.2,
        requestId: input.serviceRequestId,
        persist: false,
      });
      if (computation) {
        analysis = {
          ...analysis,
          price: {
            ...analysis.price,
            min: computation.suggestedMin,
            typical: computation.suggestedAvg,
            max: computation.suggestedPremium,
          },
        };
      }
    }
  } catch {
    /* catalog fallback */
  }

  void emitAiLearningEvent({
    eventType: "job_prep_shown",
    serviceRequestId: input.serviceRequestId,
    metadata: { serviceKey: analysis.serviceKey },
  });

  let extras:
    | {
        visionTools?: string[];
        visionMaterials?: string[];
        vision?: ProviderPrepSummary["vision"];
      }
    | undefined;

  if (isAiEngineV5Enabled()) {
    try {
      const { getLatestVisionForRequest } = await import("@/lib/ai/vision/cache");
      const visionRow = await getLatestVisionForRequest(input.serviceRequestId);
      if (visionRow) {
        const fusion = visionRow.fusion;
        const a = visionRow.analysis;
        extras = {
          visionTools: fusion?.suggestedTools,
          visionMaterials: fusion?.suggestedMaterials,
          vision: {
            detectedObjects: a.objects.map((o) => o.name),
            likelyDamage: a.damages.map((d) => d.type),
            estimatedRisk: a.estimatedRisk,
            imageConfidence: visionRow.confidence ?? a.overallConfidence,
            contradiction: fusion?.contradiction ?? false,
          },
        };
      }
    } catch {
      // Vision enrichment is best-effort.
    }
  }

  return buildProviderPrepSummary(analysis, input.locale ?? "en", extras);
}
