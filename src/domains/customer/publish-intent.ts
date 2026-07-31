import { createClient } from "@/lib/supabase/server";
import { revalidateOrderSurfaces } from "@/lib/orders/revalidate";
import { afterLegacyMarketplaceWrite } from "@/domains/marketplace/repository";
import { syncMarketplaceRequestProjection } from "@/domains/marketplace/projection";
import { runMatchingForRequest } from "@/domains/matching";
import { logger } from "@/lib/observability/logger";
import {
  isAiEngineV1Enabled,
  isAiEngineV4Enabled,
  isAiEngineV5Enabled,
  isAiEngineV6Enabled,
  isEmergencyDispatchEnabled,
  isMatchingV2Enabled,
  isMultiServiceProjectsEnabled,
} from "@/lib/config/feature-flags";
import type { PublishIntentInput } from "@/domains/customer/intent-types";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/providers/constants";
import {
  MAX_REQUEST_PHOTOS,
  SERVICE_REQUEST_MEDIA_BUCKET,
} from "@/lib/service-requests/constants";
import { buildServiceRequestMediaPath } from "@/lib/service-requests/storage";
import { recordIntentMemory } from "@/lib/ai/memory/record";
import { applyKnowledgeFeedback } from "@/lib/ai/knowledge/feedback";
import {
  learnFromUrgencyCorrection,
  learnFromWorkflowOverride,
} from "@/lib/ai/learning/match-feedback";
import { urgencyToMarketplace } from "@/lib/ai/urgency/detect";
import type { AiUrgencyLevel } from "@/lib/ai/decision/types";
import { getLocalizedText } from "@/types/domain.types";

export type PublishIntentResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

/**
 * Marketplace-native publish (lifecycle_version = 2, no provider yet).
 * When MATCHING_V2 is on, runs scarce assignment after insert (best-effort).
 */
export async function publishIntentRequest(input: {
  customerId: string;
  data: PublishIntentInput;
  photos?: File[];
  visionAnalysisId?: string | null;
  voiceTranscriptId?: string | null;
  voiceAudio?: File | null;
}): Promise<PublishIntentResult> {
  const intentText = input.data.intentText.trim();
  if (intentText.length < 8) return { ok: false, error: "intent_too_short" };
  if (!input.data.categoryId) return { ok: false, error: "category_required" };
  if (!input.data.cityId) return { ok: false, error: "location_required" };
  if (input.data.urgency !== "emergency" && input.data.urgency !== "normal") {
    return { ok: false, error: "urgency_required" };
  }

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, is_active")
    .eq("id", input.data.categoryId)
    .eq("is_active", true)
    .maybeSingle();
  if (!category) return { ok: false, error: "category_invalid" };

  const { data: city } = await supabase
    .from("cities")
    .select("id, name, is_active")
    .eq("id", input.data.cityId)
    .eq("is_active", true)
    .maybeSingle();
  if (!city) return { ok: false, error: "location_invalid" };

  const title =
    intentText.length > 80 ? `${intentText.slice(0, 77)}…` : intentText;
  const now = new Date().toISOString();

  const { data: request, error } = await supabase
    .from("service_requests")
    .insert({
      customer_id: input.customerId,
      provider_id: null,
      title,
      description: intentText,
      intent_text: intentText,
      location_text: input.data.locationText?.trim() || null,
      category_id: input.data.categoryId,
      city_id: input.data.cityId,
      urgency: input.data.urgency,
      category_confirmed: true,
      lifecycle_version: 2,
      status: "pending",
      published_at: now,
    })
    .select("id")
    .single();

  if (error || !request) {
    console.error("[publishIntentRequest] insert failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      customerId: input.customerId,
      categoryId: input.data.categoryId,
      cityId: input.data.cityId,
    });
    return { ok: false, error: "publish_failed" };
  }

  const photos = (input.photos ?? []).slice(0, MAX_REQUEST_PHOTOS);
  for (const [index, file] of photos.entries()) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) continue;
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) continue;
    const path = buildServiceRequestMediaPath(
      input.customerId,
      request.id,
      file.name || `photo-${index}.jpg`,
    );
    const { error: uploadError } = await supabase.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) continue;
    await supabase.from("service_request_images").insert({
      request_id: request.id,
      path,
      bucket: SERVICE_REQUEST_MEDIA_BUCKET,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: index,
    });
  }

  void afterLegacyMarketplaceWrite(request.id, "pending");
  void syncMarketplaceRequestProjection({
    serviceRequestId: request.id,
    legacyStatus: "pending",
    lifecycleVersion: 2,
    phase: "matching",
  });

  // Matching must not block publish; undersupply remains an honest waiting-room state.
  // Emergency mode: activate priority dispatch (runs matching + timeline) instead of plain match.
  // Multi-service: create parent project + packages (matching runs per package).
  let multiProjectCreated = false;
  if (isMultiServiceProjectsEnabled() && input.data.urgency !== "emergency") {
    try {
      const { createMultiServiceProject } = await import("@/lib/projects");
      const created = await createMultiServiceProject({
        rootServiceRequestId: request.id,
        customerId: input.customerId,
        intentText,
        primaryCategorySlug: category.slug as string,
        cityId: input.data.cityId,
        urgency: input.data.urgency,
        locationText: input.data.locationText ?? null,
        runMatching: true,
      });
      multiProjectCreated = Boolean(created);
    } catch {
      multiProjectCreated = false;
    }
  }

  if (
    isEmergencyDispatchEnabled() &&
    input.data.urgency === "emergency"
  ) {
    try {
      const { activateEmergencyDispatch } = await import(
        "@/lib/ai/dispatch/emergency"
      );
      await activateEmergencyDispatch({
        serviceRequestId: request.id,
        customerId: input.customerId,
      });
    } catch {
      if (isMatchingV2Enabled()) {
        try {
          await runMatchingForRequest(request.id);
        } catch {
          /* best-effort */
        }
      }
    }
  } else if (!multiProjectCreated && isMatchingV2Enabled()) {
    try {
      await runMatchingForRequest(request.id);
    } catch (error) {
      // best-effort — pool/assignments can be retried via expandMatchPool later
      logger.error("customer.publish-intent", "runMatchingForRequest failed", {
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  revalidateOrderSurfaces(request.id);

  if (isAiEngineV1Enabled()) {
    const finalSlug = category.slug as string;
    const suggestedId = input.data.suggestedCategoryId?.trim() || null;
    const suggestedSlug =
      input.data.suggestedCategorySlug?.trim() || suggestedId || null;
    const wasCorrected = Boolean(
      suggestedId && suggestedId !== input.data.categoryId,
    );

    void recordIntentMemory({
      serviceRequestId: request.id,
      customerId: input.customerId,
      originalText: intentText,
      detectedCategorySlug: suggestedSlug,
      confidence: input.data.suggestedConfidence ?? null,
      questionsAsked: [],
      finalCategorySlug: finalSlug,
      finalCategoryId: input.data.categoryId,
      source: wasCorrected ? "user" : "hybrid",
      wasCorrected,
      metadata: {
        categoryLabelEn: getLocalizedText(category.name, "en"),
        categoryLabelAr: getLocalizedText(category.name, "ar"),
      },
    });

    void applyKnowledgeFeedback({
      text: intentText,
      kind: wasCorrected ? "correct" : "confirm",
      suggestedCategorySlug: suggestedSlug ?? finalSlug,
      finalCategorySlug: finalSlug,
      customerId: input.customerId,
      serviceRequestId: request.id,
    });

    const suggestedUrgency = input.data.suggestedUrgency as
      | AiUrgencyLevel
      | undefined;
    if (suggestedUrgency) {
      const finalLevel: AiUrgencyLevel =
        input.data.urgency === "emergency"
          ? suggestedUrgency === "critical"
            ? "critical"
            : "high"
          : suggestedUrgency === "low"
            ? "low"
            : "medium";
      // If user marketplace urgency disagrees with AI mapping, record correction.
      if (urgencyToMarketplace(suggestedUrgency) !== input.data.urgency) {
        void learnFromUrgencyCorrection({
          suggested: suggestedUrgency,
          final: finalLevel,
          serviceRequestId: request.id,
          customerId: input.customerId,
        });
      }
    }

    if (input.data.suggestedWorkflow) {
      const finalWorkflow =
        input.data.urgency === "emergency"
          ? "emergency_dispatch"
          : "collect_offers";
      void learnFromWorkflowOverride({
        suggested: input.data.suggestedWorkflow,
        final: finalWorkflow,
        serviceRequestId: request.id,
      });
    }
  }

  if (isAiEngineV4Enabled()) {
    void import("@/lib/ai/jobs/service").then(({ analyzeAndStoreJob }) =>
      analyzeAndStoreJob({
        text: intentText,
        serviceRequestId: request.id,
        categorySlug: category.slug as string,
        emergency: input.data.urgency === "emergency",
      }),
    );
  }

  if (isAiEngineV5Enabled() && input.visionAnalysisId) {
    void import("@/lib/ai/vision/cache").then(({ attachVisionAnalysisToRequest }) =>
      attachVisionAnalysisToRequest({
        analysisId: input.visionAnalysisId!,
        serviceRequestId: request.id,
      }),
    );
  }

  if (isAiEngineV6Enabled() && input.voiceTranscriptId) {
    void (async () => {
      try {
        let audioPath: string | null = null;
        const voiceFile = input.voiceAudio;
        if (
          voiceFile &&
          voiceFile.size > 0 &&
          voiceFile.size <= 1.5 * 1024 * 1024
        ) {
          const path = buildServiceRequestMediaPath(
            input.customerId,
            request.id,
            voiceFile.name || "voice.webm",
          );
          const { error: uploadError } = await supabase.storage
            .from(SERVICE_REQUEST_MEDIA_BUCKET)
            .upload(path, voiceFile, {
              contentType: voiceFile.type || "audio/webm",
              upsert: false,
            });
          if (!uploadError) audioPath = path;
        }
        const { attachVoiceToRequest } = await import("@/lib/ai/voice/cache");
        await attachVoiceToRequest({
          transcriptId: input.voiceTranscriptId!,
          serviceRequestId: request.id,
          audioPath,
          audioBucket: SERVICE_REQUEST_MEDIA_BUCKET,
        });
      } catch {
        // Voice attach is best-effort.
      }
    })();
  }

  return { ok: true, requestId: request.id };
}
