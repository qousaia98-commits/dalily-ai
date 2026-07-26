"use server";

import { getAuthUser } from "@/lib/auth/session";
import { isCustomerIntentFlowV2Enabled } from "@/lib/config/feature-flags";
import { suggestIntentIntelligence } from "@/domains/customer/suggest-category";
import { publishIntentRequest } from "@/domains/customer/publish-intent";
import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";
import { getLeafCategories } from "@/lib/categories/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { AiDecision } from "@/lib/ai/decision/types";

export type IntentActionState = {
  success: boolean;
  error?: string;
  requestId?: string;
  suggestion?: CategorySuggestion | null;
  /** Phase 2 structured decision (null when AI_ENGINE_V2 off). */
  decision?: AiDecision | null;
  categories?: Array<{
    id: string;
    slug: string;
    labelEn: string;
    labelAr: string;
  }>;
};

export async function suggestIntentCategoryAction(
  intentText: string,
): Promise<IntentActionState> {
  if (!isCustomerIntentFlowV2Enabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const { suggestion, decision } = await suggestIntentIntelligence(intentText);
  const leaves = await getLeafCategories();
  return {
    success: true,
    suggestion,
    decision,
    categories: leaves.map((leaf) => ({
      id: leaf.id,
      slug: leaf.slug,
      labelEn: getLocalizedText(leaf.name, "en") || leaf.slug,
      labelAr: getLocalizedText(leaf.name, "ar") || leaf.slug,
    })),
  };
}

export async function publishIntentRequestAction(
  formData: FormData,
): Promise<IntentActionState> {
  if (!isCustomerIntentFlowV2Enabled()) {
    return { success: false, error: "feature_disabled" };
  }

  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const urgencyRaw = String(formData.get("urgency") ?? "normal");
  const urgency: IntentUrgency =
    urgencyRaw === "emergency" ? "emergency" : "normal";

  const photos = formData
    .getAll("photos")
    .filter((v): v is File => typeof File !== "undefined" && v instanceof File && v.size > 0);

  const visionAnalysisId =
    String(formData.get("visionAnalysisId") ?? "").trim() || null;

  const voiceTranscriptId =
    String(formData.get("voiceTranscriptId") ?? "").trim() || null;
  const voiceAudioRaw = formData.get("voiceAudio");
  const voiceAudio =
    typeof File !== "undefined" &&
    voiceAudioRaw instanceof File &&
    voiceAudioRaw.size > 0
      ? voiceAudioRaw
      : null;

  const result = await publishIntentRequest({
    customerId: authUser.id,
    data: {
      intentText: String(formData.get("intentText") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      cityId: String(formData.get("cityId") ?? ""),
      urgency,
      locationText: String(formData.get("locationText") ?? "") || undefined,
      suggestedCategoryId:
        String(formData.get("suggestedCategoryId") ?? "") || undefined,
      suggestedCategorySlug:
        String(formData.get("suggestedCategorySlug") ?? "") || undefined,
      suggestedConfidence: (() => {
        const raw = String(formData.get("suggestedConfidence") ?? "");
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
      })(),
      suggestedUrgency:
        (String(formData.get("suggestedUrgency") ?? "") as
          | "critical"
          | "high"
          | "medium"
          | "low") || undefined,
      suggestedWorkflow:
        String(formData.get("suggestedWorkflow") ?? "") || undefined,
    },
    photos,
    visionAnalysisId,
    voiceTranscriptId,
    voiceAudio,
  });

  if (!result.ok) return { success: false, error: result.error };
  return { success: true, requestId: result.requestId };
}
