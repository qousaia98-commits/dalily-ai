import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { DispatchScoreResult, ExposureMode } from "@/lib/ai/dispatch/types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export async function persistDispatchPredictions(input: {
  serviceRequestId: string;
  exposureMode: ExposureMode;
  ranked: Array<{
    providerId: string;
    matchAssignmentId?: string | null;
    rank: number;
    score: DispatchScoreResult;
  }>;
}): Promise<void> {
  if (input.ranked.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = input.ranked.map((r) => ({
      service_request_id: input.serviceRequestId,
      provider_id: r.providerId,
      match_assignment_id: r.matchAssignmentId ?? null,
      exposure_mode: input.exposureMode,
      response_band: r.score.responseBand,
      response_probability: r.score.responseProbability,
      eta_minutes_min: r.score.eta.minutesMin,
      eta_minutes_max: r.score.eta.minutesMax,
      eta_label: r.score.eta.labelEn,
      predicted_duration_minutes: r.score.capacity.estimatedJobMinutes,
      operational_score: r.score.operationalScore,
      reputation_score: r.score.reputationScore,
      distance_km: r.score.distanceKm,
      capacity_remaining_minutes: r.score.capacity.remainingMinutes,
      route_fit: r.score.routeFit.fits,
      predicted_rank: r.rank,
      metadata: {
        explanations: r.score.explanations,
      } as Json,
    }));

    await admin.from("ai_dispatch_predictions").insert(rows as never);

    void emitAiLearningEvent({
      eventType: "dispatch_planned",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        exposureMode: input.exposureMode,
        count: rows.length,
        topScore: rows[0]?.operational_score ?? null,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_dispatch_predictions]", error);
    }
  }
}

export async function upsertProviderReputation(
  providerId: string,
  score: number,
  factors: Record<string, number>,
  sampleSize: number,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin.from("ai_provider_reputation").upsert(
      {
        provider_id: providerId,
        reputation_score: score,
        factors: factors as Json,
        sample_size: sampleSize,
        computed_at: now,
        updated_at: now,
      },
      { onConflict: "provider_id" },
    );
    void emitAiLearningEvent({
      eventType: "reputation_updated",
      providerId,
      metadata: { score, sampleSize },
    });
  } catch {
    // ignore
  }
}
