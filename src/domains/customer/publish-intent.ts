import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { afterLegacyMarketplaceWrite } from "@/domains/marketplace/repository";
import { syncMarketplaceRequestProjection } from "@/domains/marketplace/projection";
import { runMatchingForRequest } from "@/domains/matching/engine";
import { isMatchingV2Enabled } from "@/lib/config/feature-flags";
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
    .select("id, name, is_active")
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
  if (isMatchingV2Enabled()) {
    try {
      await runMatchingForRequest(request.id);
    } catch {
      // best-effort — pool/assignments can be retried via expandMatchPool later
    }
  }

  revalidatePath("/account/requests");
  revalidatePath(`/request/${request.id}/waiting`);

  return { ok: true, requestId: request.id };
}
