/**
 * Cache Vision analyses by content hash — skip duplicate Vision API calls.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { IntentVisionAnalysis, VisionTextFusionResult } from "./types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export type CachedVisionRow = {
  id: string;
  analysis: IntentVisionAnalysis;
  fusion: VisionTextFusionResult | null;
  customerSummaryEn: string | null;
  customerSummaryAr: string | null;
  customerConfirmed: boolean | null;
  customerCorrection: string | null;
  confidence: number | null;
};

export async function getVisionAnalysisByHash(
  contentHash: string,
): Promise<CachedVisionRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_vision_analyses")
      .select(
        "id, analysis, fusion, customer_summary_en, customer_summary_ar, customer_confirmed, customer_correction, confidence",
      )
      .eq("content_hash", contentHash)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      analysis: data.analysis as IntentVisionAnalysis,
      fusion: (data.fusion as VisionTextFusionResult | null) ?? null,
      customerSummaryEn: (data.customer_summary_en as string | null) ?? null,
      customerSummaryAr: (data.customer_summary_ar as string | null) ?? null,
      customerConfirmed: (data.customer_confirmed as boolean | null) ?? null,
      customerCorrection: (data.customer_correction as string | null) ?? null,
      confidence: data.confidence != null ? Number(data.confidence) : null,
    };
  } catch {
    return null;
  }
}

export async function upsertVisionAnalysis(input: {
  contentHash: string;
  analysis: IntentVisionAnalysis;
  fusion: VisionTextFusionResult;
  mimeType?: string;
  byteSize?: number;
  imagePath?: string | null;
  serviceRequestId?: string | null;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const row = {
      content_hash: input.contentHash,
      analysis: input.analysis as unknown as Json,
      fusion: input.fusion as unknown as Json,
      customer_summary_en: input.fusion.customerSummaryEn,
      customer_summary_ar: input.fusion.customerSummaryAr,
      confidence: input.fusion.fusedConfidence,
      mime_type: input.mimeType ?? null,
      byte_size: input.byteSize ?? null,
      image_path: input.imagePath ?? null,
      service_request_id: input.serviceRequestId ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("ai_vision_analyses")
      .upsert(row as never, { onConflict: "content_hash" })
      .select("id")
      .single();

    if (error || !data) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ai.vision.cache] upsert failed", error?.message);
      }
      return null;
    }

    void emitAiLearningEvent({
      eventType: "vision_analyzed",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        analysisId: data.id,
        confidence: input.fusion.fusedConfidence,
        contradiction: input.fusion.contradiction,
        objects: input.analysis.objects.map((o) => o.name),
        damages: input.analysis.damages.map((d) => d.type),
      },
    });

    return data.id as string;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai.vision.cache]", error);
    }
    return null;
  }
}

export async function attachVisionAnalysisToRequest(input: {
  analysisId: string;
  serviceRequestId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("ai_vision_analyses")
      .update({
        service_request_id: input.serviceRequestId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", input.analysisId);
  } catch {
    // non-blocking
  }
}

export async function confirmVisionAnalysis(input: {
  analysisId: string;
  confirmed: boolean;
  correction?: string | null;
  customerId?: string | null;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("ai_vision_analyses")
      .update({
        customer_confirmed: input.confirmed,
        customer_correction: input.correction?.trim() || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", input.analysisId);

    if (error) return false;

    void emitAiLearningEvent({
      eventType: input.confirmed ? "vision_confirmed" : "vision_corrected",
      customerId: input.customerId,
      metadata: {
        analysisId: input.analysisId,
        correction: input.correction ?? null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getLatestVisionForRequest(
  serviceRequestId: string,
): Promise<CachedVisionRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_vision_analyses")
      .select(
        "id, analysis, fusion, customer_summary_en, customer_summary_ar, customer_confirmed, customer_correction, confidence",
      )
      .eq("service_request_id", serviceRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      analysis: data.analysis as IntentVisionAnalysis,
      fusion: (data.fusion as VisionTextFusionResult | null) ?? null,
      customerSummaryEn: (data.customer_summary_en as string | null) ?? null,
      customerSummaryAr: (data.customer_summary_ar as string | null) ?? null,
      customerConfirmed: (data.customer_confirmed as boolean | null) ?? null,
      customerCorrection: (data.customer_correction as string | null) ?? null,
      confidence: data.confidence != null ? Number(data.confidence) : null,
    };
  } catch {
    return null;
  }
}
