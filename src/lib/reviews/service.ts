/**
 * Review submit / edit / delete-request / media / response sync.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkReviewEligibility,
  getEditWindowDays,
  getFakeRiskThreshold,
} from "@/lib/reviews/eligibility";
import {
  analyzeReviewText,
  enrichWithDuplicateSignals,
  persistAiAnalysis,
  buildProviderAiSummary,
} from "@/lib/reviews/ai-analysis";
import {
  REVIEW_DIMENSIONS,
  type DimensionScores,
} from "@/lib/reviews/dimensions";
import { trackReviewEvent } from "@/lib/reviews/observability";
import { SERVICE_REQUEST_MEDIA_BUCKET } from "@/lib/service-requests/constants";
import { MAX_REVIEW_PHOTOS } from "@/lib/reviews/types";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/providers/constants";
import { isReviewsReputationV2Enabled } from "@/lib/config/feature-flags";

export type MediaKind = "before" | "after" | "completed" | "general" | "video";

export type SubmitReviewInput = {
  customerId: string;
  serviceRequestId: string;
  rating: number;
  comment?: string | null;
  recommend: boolean | null;
  isAnonymous: boolean;
  dimensions?: DimensionScores;
  language?: string;
  photos?: Array<{ file: File; kind?: MediaKind }>;
};

export type SubmitReviewResult =
  | { ok: true; reviewId: string; status: string; blocked: boolean }
  | { ok: false; error: string };

export async function submitVerifiedReview(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  const eligibility = await checkReviewEligibility({
    customerId: input.customerId,
    serviceRequestId: input.serviceRequestId,
  });

  if (!eligibility.eligible || !eligibility.providerId) {
    return { ok: false, error: eligibility.reason ?? "invalid_status" };
  }

  const editDays = await getEditWindowDays();
  const editableUntil = new Date(
    Date.now() + editDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const v2 = isReviewsReputationV2Enabled();
  let analysis = analyzeReviewText({
    rating: input.rating,
    comment: input.comment ?? null,
    recommend: input.recommend,
    dimensions: input.dimensions,
    languageHint: input.language,
  });

  const { block, threshold } = await getFakeRiskThreshold();
  let status: "approved" | "pending" | "hidden" = "approved";
  let blocked = false;

  // Never auto-publish high-risk reviews when V2 + block setting are on
  if (v2 && block && analysis.fakeRiskScore >= threshold) {
    status = "pending";
    blocked = true;
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const client = admin;

  const insertPayload = {
    service_request_id: input.serviceRequestId,
    provider_id: eligibility.providerId,
    customer_id: input.customerId,
    rating: input.rating,
    comment: input.comment?.trim() || null,
    recommend: input.recommend,
    is_anonymous: input.isAnonymous,
    is_verified: true,
    verified_booking: true,
    verified_customer: true,
    verified_interaction: true,
    status,
    language: analysis.languageDetected,
    editable_until: editableUntil,
    ai_summary: analysis.shortSummary,
    sentiment: analysis.sentiment,
    ...(eligibility.bookingId ? { booking_id: eligibility.bookingId } : {}),
  };

  const { data: review, error } = await client
    .from("service_reviews")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !review) {
    // Fallback: columns may not exist yet — insert legacy shape
    const { data: legacy, error: legacyErr } = await client
      .from("service_reviews")
      .insert({
        service_request_id: input.serviceRequestId,
        provider_id: eligibility.providerId,
        customer_id: input.customerId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
        recommend: input.recommend,
        is_anonymous: input.isAnonymous,
        is_verified: true,
        verified_booking: true,
        verified_customer: true,
        verified_interaction: true,
        status,
      })
      .select("id")
      .single();
    if (legacyErr || !legacy) return { ok: false, error: "review_failed" };
    return finalizeReview({
      reviewId: legacy.id,
      providerId: eligibility.providerId!,
      customerId: input.customerId,
      serviceRequestId: input.serviceRequestId,
      status,
      blocked,
      analysis,
      dimensions: input.dimensions,
      photos: input.photos,
      v2,
      admin,
    });
  }

  return finalizeReview({
    reviewId: review.id,
    providerId: eligibility.providerId!,
    customerId: input.customerId,
    serviceRequestId: input.serviceRequestId,
    status,
    blocked,
    analysis,
    dimensions: input.dimensions,
    photos: input.photos,
    v2,
    admin,
  });
}

async function finalizeReview(ctx: {
  reviewId: string;
  providerId: string;
  customerId: string;
  serviceRequestId: string;
  status: string;
  blocked: boolean;
  analysis: ReturnType<typeof analyzeReviewText>;
  dimensions?: DimensionScores;
  photos?: Array<{ file: File; kind?: MediaKind }>;
  v2: boolean;
  admin: ReturnType<typeof createAdminClient>;
}): Promise<SubmitReviewResult> {
  if (ctx.dimensions) {
    await upsertDimensions(ctx.reviewId, ctx.dimensions);
  }

  if (ctx.photos && ctx.photos.length > 0) {
    await uploadReviewMedia(
      ctx.reviewId,
      ctx.providerId,
      ctx.customerId,
      ctx.photos,
    );
  }

  {
    const { data: row } = await ctx.admin
      .from("service_reviews")
      .select("comment")
      .eq("id", ctx.reviewId)
      .maybeSingle();
    const withDupes = await enrichWithDuplicateSignals(
      ctx.reviewId,
      ctx.providerId,
      ctx.customerId,
      row?.comment ?? null,
      ctx.analysis,
    );

    const { block, threshold } = await getFakeRiskThreshold();
    let status = ctx.status;
    let blocked = ctx.blocked;
    if (
      ctx.v2 &&
      block &&
      withDupes.fakeRiskScore >= threshold &&
      status === "approved"
    ) {
      status = "pending";
      blocked = true;
      await ctx.admin
        .from("service_reviews")
        .update({ status: "pending" })
        .eq("id", ctx.reviewId);
    }

    await persistAiAnalysis(ctx.reviewId, withDupes);
    void trackReviewEvent("ai_analysis_completed", {
      reviewId: ctx.reviewId,
      providerId: ctx.providerId,
      fakeRisk: withDupes.fakeRiskScore,
    });

    if (blocked) {
      void trackReviewEvent("review_flagged", {
        reviewId: ctx.reviewId,
        providerId: ctx.providerId,
        signals: withDupes.fakeSignals,
      });
    } else {
      void trackReviewEvent("review_approved", {
        reviewId: ctx.reviewId,
        providerId: ctx.providerId,
      });
    }

    await refreshProviderReputation(ctx.providerId);

    // Use possibly updated blocked/status for return
    ctx.status = status;
    ctx.blocked = blocked;
  }

  const supabase = await createClient();
  await supabase
    .from("service_requests")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
    .eq("id", ctx.serviceRequestId)
    .eq("status", "completed");

  await supabase.rpc("recompute_provider_trust_score", {
    p_provider_id: ctx.providerId,
  });

  void trackReviewEvent("review_submitted", {
    reviewId: ctx.reviewId,
    providerId: ctx.providerId,
    status: ctx.status,
    blocked: ctx.blocked,
  });

  return {
    ok: true,
    reviewId: ctx.reviewId,
    status: ctx.status,
    blocked: ctx.blocked,
  };
}

export async function editReview(input: {
  customerId: string;
  reviewId: string;
  rating: number;
  comment?: string | null;
  recommend: boolean | null;
  isAnonymous?: boolean;
  dimensions?: DimensionScores;
}): Promise<SubmitReviewResult> {
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("service_reviews")
    .select(
      "id, provider_id, customer_id, editable_until, provider_reply, edit_count, status, deleted_at",
    )
    .eq("id", input.reviewId)
    .eq("customer_id", input.customerId)
    .maybeSingle();

  if (!review || review.deleted_at) return { ok: false, error: "not_found" };
  if (review.provider_reply) return { ok: false, error: "provider_replied" };
  if (
    !review.editable_until ||
    new Date(review.editable_until).getTime() < Date.now()
  ) {
    return { ok: false, error: "edit_locked" };
  }

  const analysis = analyzeReviewText({
    rating: input.rating,
    comment: input.comment ?? null,
    recommend: input.recommend,
    dimensions: input.dimensions,
  });

  const { block, threshold } = await getFakeRiskThreshold();
  let status: "pending" | "approved" | "rejected" | "hidden" = review.status as
    | "pending"
    | "approved"
    | "rejected"
    | "hidden";
  let blocked = false;
  if (isReviewsReputationV2Enabled() && block && analysis.fakeRiskScore >= threshold) {
    status = "pending";
    blocked = true;
  }

  const { error } = await supabase
    .from("service_reviews")
    .update({
      rating: input.rating,
      comment: input.comment?.trim() || null,
      recommend: input.recommend,
      is_anonymous: input.isAnonymous ?? undefined,
      edit_count: (review.edit_count ?? 0) + 1,
      ai_summary: analysis.shortSummary,
      sentiment: analysis.sentiment,
      language: analysis.languageDetected,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.reviewId);

  if (error) return { ok: false, error: "failed" };

  if (input.dimensions) await upsertDimensions(input.reviewId, input.dimensions);
  if (isReviewsReputationV2Enabled()) {
    await persistAiAnalysis(input.reviewId, analysis);
    await refreshProviderReputation(review.provider_id);
  }

  await supabase.rpc("recompute_provider_trust_score", {
    p_provider_id: review.provider_id,
  });

  void trackReviewEvent("review_edited", {
    reviewId: input.reviewId,
    providerId: review.provider_id,
  });

  return { ok: true, reviewId: input.reviewId, status, blocked };
}

export async function requestReviewDelete(input: {
  customerId: string;
  reviewId: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("service_reviews")
    .select("id, provider_id, customer_id")
    .eq("id", input.reviewId)
    .eq("customer_id", input.customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!review) return { ok: false, error: "not_found" };

  const { error } = await supabase
    .from("service_reviews")
    .update({
      delete_requested_at: new Date().toISOString(),
      delete_request_reason: input.reason?.trim() || null,
    })
    .eq("id", input.reviewId);

  if (error) return { ok: false, error: "failed" };

  try {
    const admin = createAdminClient();
    await admin.from("review_moderation").insert({
      review_id: input.reviewId,
      action: "delete_request",
      actor_id: input.customerId,
      note: input.reason ?? null,
    });
  } catch {
    /* table may be missing pre-migration */
  }

  return { ok: true };
}

export async function syncProviderResponse(input: {
  reviewId: string;
  providerId: string;
  body: string;
  actorId: string;
  edited?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("service_reviews")
    .update({
      provider_reply: input.body,
      provider_replied_at: now,
      provider_reply_by: input.actorId,
      updated_at: now,
    })
    .eq("id", input.reviewId)
    .eq("provider_id", input.providerId);

  if (error) return { ok: false, error: "failed" };

  try {
    const admin = createAdminClient();
    await admin.from("review_responses").upsert(
      {
        review_id: input.reviewId,
        provider_id: input.providerId,
        body: input.body,
        created_by: input.actorId,
        created_at: now,
        edited_at: input.edited ? now : null,
      },
      { onConflict: "review_id" },
    );
  } catch {
    /* optional table */
  }

  void trackReviewEvent("provider_responded", {
    reviewId: input.reviewId,
    providerId: input.providerId,
  });

  await supabase.rpc("recompute_provider_trust_score", {
    p_provider_id: input.providerId,
  });

  return { ok: true };
}

async function upsertDimensions(reviewId: string, scores: DimensionScores) {
  try {
    const admin = createAdminClient();
    const rows = REVIEW_DIMENSIONS.filter((d) => scores[d] != null).map(
      (dimension) => ({
        review_id: reviewId,
        dimension,
        score: scores[dimension]!,
      }),
    );
    if (rows.length === 0) return;
    await admin.from("review_ratings").upsert(rows, {
      onConflict: "review_id,dimension",
    });
  } catch {
    /* pre-migration */
  }
}

export async function uploadReviewMedia(
  reviewId: string,
  providerId: string,
  ownerId: string,
  items: Array<{ file: File; kind?: MediaKind }>,
): Promise<void> {
  if (items.length === 0) return;
  const supabase = await createClient();
  const limited = items.slice(0, MAX_REVIEW_PHOTOS);

  for (let i = 0; i < limited.length; i++) {
    const { file, kind } = limited[i];
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

    const mediaKind = kind ?? "completed";

    await supabase.from("service_review_images").insert({
      review_id: reviewId,
      path,
      bucket: SERVICE_REQUEST_MEDIA_BUCKET,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: i,
      media_kind: mediaKind,
    });

    try {
      await createAdminClient().from("review_media").insert({
        review_id: reviewId,
        media_kind: mediaKind,
        bucket: SERVICE_REQUEST_MEDIA_BUCKET,
        path,
        mime_type: file.type,
        size_bytes: file.size,
        sort_order: i,
        moderation_status: "approved",
      });
    } catch {
      /* optional */
    }

    void trackReviewEvent("media_uploaded", {
      reviewId,
      providerId,
      mediaKind,
    });

    // Image moderation hook (future: Vision AI)
    void runImageModerationHook(reviewId, path);
  }
}

function runImageModerationHook(reviewId: string, path: string): void {
  // Hook point — never blocks publish; flags for admin if needed later
  void trackReviewEvent("media_moderation_hook", { reviewId, path });
}

export async function refreshProviderReputation(providerId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: reviews } = await admin
      .from("service_reviews")
      .select("ai_summary, sentiment, rating, recommend")
      .eq("provider_id", providerId)
      .eq("status", "approved")
      .is("deleted_at", null)
      .limit(100);

    const summary = buildProviderAiSummary(reviews ?? []);
    await admin.from("provider_reputation_cache").upsert(
      {
        provider_id: providerId,
        ai_summary_en: summary.en || null,
        ai_summary_ar: summary.ar || null,
        quality_label: summary.qualityLabel || null,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" },
    );
  } catch {
    /* optional cache */
  }

  try {
    const { recalculateProviderReputation } = await import("@/lib/reputation/service");
    await recalculateProviderReputation(providerId, { snapshotPeriod: "snapshot" });
  } catch {
    /* Phase 3 engine optional until migrated */
  }
}

export async function auditModeration(input: {
  reviewId: string;
  action: string;
  actorId: string;
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createAdminClient().from("review_moderation").insert({
      review_id: input.reviewId,
      action: input.action,
      actor_id: input.actorId,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    /* optional */
  }
}
