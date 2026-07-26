/**
 * After completion — compare predicted voice category vs final category.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export async function compareVoiceTranscriptOutcome(input: {
  serviceRequestId: string;
  finalCategorySlug?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("ai_voice_transcripts")
      .select(
        "id, original_transcript, edited_transcript, detected_category_slug, interpretation, service_request_id",
      )
      .eq("service_request_id", input.serviceRequestId)
      .is("compared_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return;

    const finalSlug = input.finalCategorySlug ?? null;

    await admin
      .from("ai_voice_transcripts")
      .update({
        final_category_slug: finalSlug,
        compared_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id);

    void emitAiLearningEvent({
      eventType: "voice_category_compared",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        originalTranscript: row.original_transcript,
        editedTranscript: row.edited_transcript,
        predictedCategory: row.detected_category_slug,
        finalCategory: finalSlug,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[voice.compare]", error);
    }
  }
}
