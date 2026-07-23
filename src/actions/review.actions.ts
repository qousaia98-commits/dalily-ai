"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import { logLearningEvent } from "@/lib/search/learning";
import { SERVICE_REQUEST_MEDIA_BUCKET } from "@/lib/service-requests/constants";
import { MAX_REVIEW_PHOTOS } from "@/lib/reviews/types";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/providers/constants";

export type ReviewActionState = {
  success: boolean;
  error?: string;
  helpfulCount?: number;
  voted?: boolean;
};

async function trackReviewAnalytics(
  event: string,
  metadata: Record<string, unknown>,
  providerId?: string | null,
) {
  const user = await getAuthUser();
  await logLearningEvent({
    eventType: event === "helpful_click" ? "provider_clicked" : "review_submitted",
    providerId: providerId ?? null,
    customerId: user?.id ?? null,
    metadata: { source: "reviews", reviewEvent: event, ...metadata },
  });
}

export async function toggleReviewHelpfulAction(
  reviewId: string,
): Promise<ReviewActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  if (!reviewId) return { success: false, error: "validation_error" };

  const supabase = await createClient();
  const { data: review } = await supabase
    .from("service_reviews")
    .select("id, provider_id, customer_id, helpful_count, status, deleted_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review || review.deleted_at || review.status !== "approved") {
    return { success: false, error: "not_found" };
  }
  if (review.customer_id === authUser.id) {
    return { success: false, error: "forbidden" };
  }

  const { data: existing } = await supabase
    .from("service_review_helpful_votes")
    .select("review_id")
    .eq("review_id", reviewId)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("service_review_helpful_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", authUser.id);
    void trackReviewAnalytics("helpful_click", { action: "remove", reviewId }, review.provider_id);
    return {
      success: true,
      voted: false,
      helpfulCount: Math.max(0, (review.helpful_count ?? 1) - 1),
    };
  }

  const { error } = await supabase.from("service_review_helpful_votes").insert({
    review_id: reviewId,
    user_id: authUser.id,
  });
  if (error) return { success: false, error: "failed" };

  void trackReviewAnalytics("helpful_click", { action: "add", reviewId }, review.provider_id);
  revalidatePath(`/providers/${review.provider_id}`);
  return {
    success: true,
    voted: true,
    helpfulCount: (review.helpful_count ?? 0) + 1,
  };
}

export async function replyToReviewAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const reviewId = String(formData.get("reviewId") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  if (!reviewId || reply.length < 2 || reply.length > 2000) {
    return { success: false, error: "validation_error" };
  }

  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: review } = await supabase
    .from("service_reviews")
    .select("id, provider_id, provider_reply, status, deleted_at")
    .eq("id", reviewId)
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!review || review.deleted_at || review.status !== "approved") {
    return { success: false, error: "not_found" };
  }
  if (review.provider_reply) {
    return { success: false, error: "reply_exists" };
  }

  const { error } = await supabase
    .from("service_reviews")
    .update({
      provider_reply: reply,
      provider_replied_at: new Date().toISOString(),
      provider_reply_by: authUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("provider_id", provider.id)
    .is("provider_reply", null);

  if (error) return { success: false, error: "failed" };

  void trackReviewAnalytics("provider_reply", { reviewId }, provider.id);
  revalidatePath(`/providers/${provider.id}`);
  revalidatePath("/business", "layout");
  return { success: true };
}

export async function uploadReviewImages(
  reviewId: string,
  providerId: string,
  ownerId: string,
  files: File[],
): Promise<void> {
  if (files.length === 0) return;
  const supabase = await createClient();
  const limited = files.slice(0, MAX_REVIEW_PHOTOS);

  for (let i = 0; i < limited.length; i++) {
    const file = limited[i];
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_IMAGE_BYTES) continue;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      continue;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${ownerId}/reviews/${providerId}/${reviewId}/${Date.now()}-${i}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) continue;

    await supabase.from("service_review_images").insert({
      review_id: reviewId,
      path,
      bucket: SERVICE_REQUEST_MEDIA_BUCKET,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: i,
    });
  }
}

export async function recomputeProviderTrustAction(providerId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("recompute_provider_trust_score", {
    p_provider_id: providerId,
  });
}

export async function trackReviewPhotoOpenAction(reviewId: string, providerId: string) {
  void trackReviewAnalytics("photo_opened", { reviewId }, providerId);
}
