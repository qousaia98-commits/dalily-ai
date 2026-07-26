import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { JobComplexity } from "@/lib/ai/jobs/types";

/**
 * After job completion: compare predictions vs actuals and refine knowledge sample_size.
 */
export async function compareJobAnalysisOutcome(input: {
  serviceRequestId?: string | null;
  bookingId?: string | null;
  actualDurationMinutes?: number | null;
  actualMaterials?: string[] | null;
  actualComplexity?: JobComplexity | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("ai_job_analyses")
      .select("id, service_key, analysis, service_request_id")
      .is("compared_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (input.serviceRequestId) {
      query = query.eq("service_request_id", input.serviceRequestId);
    } else if (input.bookingId) {
      query = query.eq("booking_id", input.bookingId);
    } else {
      return;
    }

    const { data: row } = await query.maybeSingle();
    if (!row) return;

    const analysis = row.analysis as {
      estimatedDuration?: { typicalMinutes?: number };
      materials?: string[];
      estimatedDifficulty?: string;
      serviceKey?: string;
    };

    const predictedDuration = analysis.estimatedDuration?.typicalMinutes ?? null;
    const durationDelta =
      input.actualDurationMinutes != null && predictedDuration != null
        ? input.actualDurationMinutes - predictedDuration
        : null;

    await admin
      .from("ai_job_analyses")
      .update({
        actual_duration_minutes: input.actualDurationMinutes ?? null,
        actual_materials: (input.actualMaterials ?? null) as Json,
        actual_complexity: input.actualComplexity ?? null,
        compared_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id);

    if (durationDelta != null) {
      void emitAiLearningEvent({
        eventType: "job_duration_compared",
        serviceRequestId: row.service_request_id as string | null,
        metadata: {
          predicted: predictedDuration,
          actual: input.actualDurationMinutes,
          deltaMinutes: durationDelta,
          serviceKey: row.service_key,
        },
      });
    }

    if (input.actualMaterials?.length) {
      void emitAiLearningEvent({
        eventType: "job_materials_compared",
        serviceRequestId: row.service_request_id as string | null,
        metadata: {
          predicted: analysis.materials ?? [],
          actual: input.actualMaterials,
          serviceKey: row.service_key,
        },
      });
    }

    if (input.actualComplexity) {
      void emitAiLearningEvent({
        eventType: "job_complexity_compared",
        serviceRequestId: row.service_request_id as string | null,
        metadata: {
          predicted: analysis.estimatedDifficulty,
          actual: input.actualComplexity,
          serviceKey: row.service_key,
        },
      });
    }

    // Soft knowledge refinement: bump sample_size on matching service_key
    if (row.service_key) {
      try {
        const { data: knowledge } = await admin
          .from("ai_service_knowledge")
          .select("id, sample_size, duration_typical_minutes")
          .eq("service_key", row.service_key)
          .maybeSingle();
        if (knowledge) {
          const sample = Number(knowledge.sample_size ?? 0) + 1;
          const patch: Record<string, unknown> = {
            sample_size: sample,
            updated_at: new Date().toISOString(),
          };
          if (
            input.actualDurationMinutes != null &&
            knowledge.duration_typical_minutes != null
          ) {
            // Exponential moving average toward actual duration
            const prev = Number(knowledge.duration_typical_minutes);
            patch.duration_typical_minutes = Math.round(
              prev * 0.8 + input.actualDurationMinutes * 0.2,
            );
          }
          await admin
            .from("ai_service_knowledge")
            .update(patch as never)
            .eq("id", knowledge.id);
        }
      } catch {
        // Catalog may exist only in code until seed sync.
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[job.compare]", error);
    }
  }
}
