/**
 * After job completion — compare predicted vision damage/tools/materials vs actuals.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { IntentVisionAnalysis, VisionTextFusionResult } from "./types";

export async function compareVisionAnalysisOutcome(input: {
  serviceRequestId: string;
  actualDamage?: string[] | null;
  actualTools?: string[] | null;
  actualMaterials?: string[] | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("ai_vision_analyses")
      .select("id, analysis, fusion, service_request_id")
      .eq("service_request_id", input.serviceRequestId)
      .is("compared_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return;

    const analysis = row.analysis as IntentVisionAnalysis;
    const fusion = row.fusion as VisionTextFusionResult | null;

    const predictedDamage = analysis.damages?.map((d) => d.type) ?? [];
    const predictedTools = fusion?.suggestedTools ?? [];
    const predictedMaterials = fusion?.suggestedMaterials ?? [];

    await admin
      .from("ai_vision_analyses")
      .update({
        actual_damage: (input.actualDamage ?? null) as Json,
        actual_tools: (input.actualTools ?? null) as Json,
        actual_materials: (input.actualMaterials ?? null) as Json,
        compared_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id);

    if (input.actualDamage?.length) {
      void emitAiLearningEvent({
        eventType: "vision_damage_compared",
        serviceRequestId: input.serviceRequestId,
        metadata: { predicted: predictedDamage, actual: input.actualDamage },
      });
    }
    if (input.actualTools?.length) {
      void emitAiLearningEvent({
        eventType: "vision_tools_compared",
        serviceRequestId: input.serviceRequestId,
        metadata: { predicted: predictedTools, actual: input.actualTools },
      });
    }
    if (input.actualMaterials?.length) {
      void emitAiLearningEvent({
        eventType: "vision_materials_compared",
        serviceRequestId: input.serviceRequestId,
        metadata: {
          predicted: predictedMaterials,
          actual: input.actualMaterials,
        },
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[vision.compare]", error);
    }
  }
}
