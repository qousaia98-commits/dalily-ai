import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { JobAnalysis } from "@/lib/ai/jobs/types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

/**
 * Persist job analysis (best-effort). Returns analysis id.
 */
export async function persistJobAnalysis(input: {
  serviceRequestId?: string | null;
  bookingId?: string | null;
  analysis: JobAnalysis;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_job_analyses")
      .insert({
        service_request_id: input.serviceRequestId ?? null,
        booking_id: input.bookingId ?? null,
        service_key: input.analysis.serviceKey,
        category_slug: input.analysis.categorySlug,
        analysis: input.analysis as unknown as Json,
        confidence: input.analysis.confidence,
      })
      .select("id")
      .single();

    if (error || !data) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ai_job_analyses]", error?.message);
      }
      return null;
    }

    void emitAiLearningEvent({
      eventType: "job_analyzed",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        analysisId: data.id,
        serviceKey: input.analysis.serviceKey,
        confidence: input.analysis.confidence,
        multiService: input.analysis.multiService,
      },
    });

    if (input.analysis.multiService) {
      void emitAiLearningEvent({
        eventType: "multi_service_detected",
        serviceRequestId: input.serviceRequestId,
        metadata: { trades: input.analysis.relatedTrades },
      });
    }

    return data.id as string;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_job_analyses]", error);
    }
    return null;
  }
}

export async function getLatestJobAnalysisForRequest(
  serviceRequestId: string,
): Promise<JobAnalysis | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_job_analyses")
      .select("analysis")
      .eq("service_request_id", serviceRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.analysis) return null;
    return data.analysis as unknown as JobAnalysis;
  } catch {
    return null;
  }
}
