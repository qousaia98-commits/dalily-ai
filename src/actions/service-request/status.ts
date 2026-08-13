"use server";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProvider } from "@/lib/providers/database";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import {
  canCompleteService,
  canConfirmCompletion,
  canDecideQuote,
  canSendQuote,
} from "@/lib/service-requests/status-machine";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import {
  createQuoteSchema,
  disputeSchema,
  reviewSchema,
} from "@/lib/validations/service-request";
import { logLearningEvent, scheduleLearningUpdate } from "@/lib/search/learning";
import { getConversationIdForRequest } from "./queries";
import { postSystemAndNotify, revalidateAfterMarketplaceWrite } from "./shared";
import type { ServiceRequestActionState } from "./types";
import { validationError } from "./validation";

export async function sendQuoteAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const parsed = createQuoteSchema.safeParse({
    requestId: formData.get("requestId"),
    price: formData.get("price"),
    currency: formData.get("currency") || "SYP",
    estimatedDuration: formData.get("estimatedDuration") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!request) return { success: false, error: "not_found" };
  if (isOffersV2Enabled() && (request.lifecycle_version ?? 1) >= 2) {
    return { success: false, error: "use_offers" };
  }
  if (!canSendQuote(request.status as ServiceRequestStatus)) {
    return { success: false, error: "invalid_status" };
  }

  await supabase
    .from("quotes")
    .update({ status: "superseded" })
    .eq("service_request_id", request.id)
    .eq("status", "sent");

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      service_request_id: request.id,
      provider_id: provider.id,
      price: parsed.data.price,
      currency: parsed.data.currency,
      estimated_duration_text: parsed.data.estimatedDuration?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      status: "sent",
    })
    .select("id")
    .single();

  if (error || !quote) return { success: false, error: "quote_failed" };

  const { data: statusUpdated, error: statusError } = await supabase
    .from("service_requests")
    .update({ status: "quoted", quoted_at: new Date().toISOString() })
    .eq("id", request.id)
    .in("status", ["accepted", "quote_declined"])
    .select("id")
    .maybeSingle();

  if (statusError || !statusUpdated) {
    await supabase.from("quotes").update({ status: "superseded" }).eq("id", quote.id);
    return { success: false, error: "invalid_status" };
  }

  const conversationId = await getConversationIdForRequest(request.id);
  await postSystemAndNotify({
    requestId: request.id,
    actorId: authUser.id,
    conversationId,
    body: `Quote sent: ${parsed.data.price} ${parsed.data.currency}`,
    eventType: "quote_sent",
    notifyUserId: request.customer_id,
    notifyType: "quote_received",
    titleKey: "notifications.quoteReceived.title",
    bodyKey: "notifications.quoteReceived.body",
    href: conversationId ? `/messages/${conversationId}` : `/account/requests/${request.id}`,
    params: { title: request.title, price: parsed.data.price, currency: parsed.data.currency },
  });

  revalidateAfterMarketplaceWrite(request.id, "quoted");
  return { success: true, message: "quote_sent", requestId: request.id, conversationId: conversationId ?? undefined };
}

export async function acceptQuoteAction(requestId: string): Promise<ServiceRequestActionState> {
  return decideQuote(requestId, "accepted");
}

export async function declineQuoteAction(requestId: string): Promise<ServiceRequestActionState> {
  return decideQuote(requestId, "declined");
}

export async function requestQuoteChangesAction(
  requestId: string,
): Promise<ServiceRequestActionState> {
  return decideQuote(requestId, "changes_requested");
}

async function decideQuote(
  requestId: string,
  decision: "accepted" | "declined" | "changes_requested",
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .eq("customer_id", authUser.id)
    .maybeSingle();

  if (!request) return { success: false, error: "not_found" };
  if (isOffersV2Enabled() && (request.lifecycle_version ?? 1) >= 2) {
    return { success: false, error: "use_offers" };
  }
  if (!request.provider_id) return { success: false, error: "invalid_status" };
  if (!canDecideQuote(request.status as ServiceRequestStatus)) {
    return { success: false, error: "invalid_status" };
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("service_request_id", requestId)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!quote) return { success: false, error: "quote_not_found" };

  const nextStatus: ServiceRequestStatus =
    decision === "accepted"
      ? "quote_accepted"
      : decision === "declined"
        ? "quote_declined"
        : "accepted";

  const patch: {
    status: ServiceRequestStatus;
    quote_accepted_at?: string;
    quote_declined_at?: string;
  } = { status: nextStatus };
  if (decision === "accepted") patch.quote_accepted_at = new Date().toISOString();
  if (decision === "declined") patch.quote_declined_at = new Date().toISOString();

  // Request first (conditional) so a failed race never leaves quote out of sync
  const { data: updated, error: updateError } = await supabase
    .from("service_requests")
    .update(patch)
    .eq("id", requestId)
    .eq("status", "quoted")
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    return { success: false, error: "invalid_status" };
  }

  await supabase
    .from("quotes")
    .update({ status: decision, responded_at: new Date().toISOString() })
    .eq("id", quote.id)
    .eq("status", "sent");

  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", request.provider_id)
    .maybeSingle();

  const conversationId = await getConversationIdForRequest(requestId);
  const eventMap = {
    accepted: {
      body: "Quote accepted. Work can begin.",
      event: "quote_accepted",
      type: "quote_accepted",
      titleKey: "notifications.quoteAccepted.title",
      bodyKey: "notifications.quoteAccepted.body",
    },
    declined: {
      body: "Quote declined.",
      event: "quote_declined",
      type: "quote_declined",
      titleKey: "notifications.quoteDeclined.title",
      bodyKey: "notifications.quoteDeclined.body",
    },
    changes_requested: {
      body: "Customer requested quote changes.",
      event: "quote_changes_requested",
      type: "quote_changes",
      titleKey: "notifications.quoteChanges.title",
      bodyKey: "notifications.quoteChanges.body",
    },
  }[decision];

  if (provider?.owner_id) {
    await postSystemAndNotify({
      requestId,
      actorId: authUser.id,
      conversationId,
      body: eventMap.body,
      eventType: eventMap.event,
      notifyUserId: provider.owner_id,
      notifyType: eventMap.type,
      titleKey: eventMap.titleKey,
      bodyKey: eventMap.bodyKey,
      href: conversationId ? `/business/messages/${conversationId}` : `/business/requests/${requestId}`,
      params: { title: request.title },
    });
  }

  revalidateAfterMarketplaceWrite(requestId, nextStatus);
  return { success: true, message: decision, conversationId: conversationId ?? undefined };
}

export async function completeServiceAction(requestId: string): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: requestMeta } = await supabase
    .from("service_requests")
    .select("id, lifecycle_version, provider_id, status")
    .eq("id", requestId)
    .maybeSingle();

  // Marketplace v2 — grant-based completion (never requires provider_id).
  if (requestMeta && (requestMeta.lifecycle_version ?? 1) >= 2 && !requestMeta.provider_id) {
    const { completeMarketplaceJobByProvider } = await import(
      "@/domains/marketplace/completion"
    );
    const result = await completeMarketplaceJobByProvider({
      serviceRequestId: requestId,
      providerId: provider.id,
      actorUserId: authUser.id,
    });
    if (!result.ok) {
      return {
        success: false,
        error:
          result.error === "forbidden"
            ? "forbidden"
            : result.error === "not_unlocked"
              ? "invalid_status"
              : result.error === "not_found"
                ? "not_found"
                : "invalid_status",
      };
    }
    revalidateAfterMarketplaceWrite(requestId, "completed_by_business");
    return {
      success: true,
      message: "completed_by_business",
      conversationId: result.conversationId ?? undefined,
    };
  }

  const { data: request } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!request) return { success: false, error: "not_found" };
  if (!request.provider_id) return { success: false, error: "invalid_status" };
  if (!canCompleteService(request.status as ServiceRequestStatus)) {
    return { success: false, error: "invalid_status" };
  }

  const { data: updated, error: updateError } = await supabase
    .from("service_requests")
    .update({
      status: "completed_by_business",
      completed_by_business_at: new Date().toISOString(),
      ...(request.status !== "in_progress"
        ? { in_progress_at: request.in_progress_at ?? new Date().toISOString() }
        : {}),
    })
    .eq("id", requestId)
    .in("status", ["accepted", "quote_accepted", "quote_declined", "in_progress", "disputed"])
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    return { success: false, error: "invalid_status" };
  }

  const conversationId = await getConversationIdForRequest(requestId);
  await postSystemAndNotify({
    requestId,
    actorId: authUser.id,
    conversationId,
    body: "Business marked this service as completed. Please confirm.",
    eventType: "service_completed",
    notifyUserId: request.customer_id,
    notifyType: "service_completed",
    titleKey: "notifications.serviceCompleted.title",
    bodyKey: "notifications.serviceCompleted.body",
    href: conversationId ? `/messages/${conversationId}` : `/account/requests/${requestId}`,
    params: { title: request.title },
  });

  revalidateAfterMarketplaceWrite(requestId, "completed_by_business");
  return { success: true, message: "completed_by_business", conversationId: conversationId ?? undefined };
}

export async function confirmCompletionAction(
  requestId: string,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const supabase = await createClient();
  const { data: requestMeta } = await supabase
    .from("service_requests")
    .select("id, lifecycle_version, provider_id, status")
    .eq("id", requestId)
    .eq("customer_id", authUser.id)
    .maybeSingle();

  if (!requestMeta) return { success: false, error: "not_found" };

  // Marketplace v2 — grant-based assignment (provider_id stays null).
  if ((requestMeta.lifecycle_version ?? 1) >= 2 && !requestMeta.provider_id) {
    const { confirmMarketplaceJobByCustomer } = await import(
      "@/domains/marketplace/completion"
    );
    const result = await confirmMarketplaceJobByCustomer({
      serviceRequestId: requestId,
      customerId: authUser.id,
    });
    if (!result.ok) {
      return {
        success: false,
        error: result.error === "not_found" ? "not_found" : "invalid_status",
      };
    }
    revalidateAfterMarketplaceWrite(requestId, "completed");
    return {
      success: true,
      message: "completed",
      conversationId: result.conversationId ?? undefined,
    };
  }

  const { data: request } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .eq("customer_id", authUser.id)
    .maybeSingle();

  if (!request) return { success: false, error: "not_found" };
  if (!request.provider_id) return { success: false, error: "invalid_status" };
  if (!canConfirmCompletion(request.status as ServiceRequestStatus)) {
    return { success: false, error: "invalid_status" };
  }

  const now = new Date();
  const completionSeconds = request.accepted_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(request.accepted_at).getTime()) / 1000))
    : null;

  const { data: updated, error: updateError } = await supabase
    .from("service_requests")
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      confirmed_at: now.toISOString(),
      completion_time_seconds: completionSeconds,
    })
    .eq("id", requestId)
    .eq("status", "completed_by_business")
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    return { success: false, error: "invalid_status" };
  }

  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", request.provider_id)
    .maybeSingle();

  const conversationId = await getConversationIdForRequest(requestId);
  if (provider?.owner_id) {
    await postSystemAndNotify({
      requestId,
      actorId: authUser.id,
      conversationId,
      body: "Customer confirmed completion. Review is unlocked.",
      eventType: "customer_confirmed",
      notifyUserId: provider.owner_id,
      notifyType: "completion_confirmed",
      titleKey: "notifications.completionConfirmed.title",
      bodyKey: "notifications.completionConfirmed.body",
      href: conversationId ? `/business/messages/${conversationId}` : `/business/requests/${requestId}`,
      params: { title: request.title },
    });
  }

  revalidateAfterMarketplaceWrite(requestId, "completed");
  void logLearningEvent({
    eventType: "request_completed",
    providerId: request.provider_id,
    customerId: authUser.id,
    serviceRequestId: requestId,
    metadata: { completion_time_seconds: completionSeconds },
  });
  scheduleLearningUpdate({
    providerId: request.provider_id,
    customerId: authUser.id,
  });
  return { success: true, message: "completed", conversationId: conversationId ?? undefined };
}

export async function reportProblemAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const parsed = disputeSchema.safeParse({
    requestId: formData.get("requestId"),
    note: formData.get("note"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .eq("customer_id", authUser.id)
    .maybeSingle();

  if (!request) return { success: false, error: "not_found" };
  if (!canConfirmCompletion(request.status as ServiceRequestStatus)) {
    return { success: false, error: "invalid_status" };
  }

  let assignedProviderId = request.provider_id as string | null;
  if (!assignedProviderId && (request.lifecycle_version ?? 1) >= 2) {
    const { getMarketplaceAssignedProviderId } = await import(
      "@/domains/marketplace/access"
    );
    assignedProviderId = await getMarketplaceAssignedProviderId(request.id);
  }
  if (!assignedProviderId) return { success: false, error: "invalid_status" };

  const updateClient =
    (request.lifecycle_version ?? 1) >= 2 && !request.provider_id
      ? createAdminClient()
      : supabase;

  const { data: updated, error: updateError } = await updateClient
    .from("service_requests")
    .update({
      status: "disputed",
      disputed_at: new Date().toISOString(),
      dispute_note: parsed.data.note,
    })
    .eq("id", request.id)
    .eq("status", "completed_by_business")
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    return { success: false, error: "invalid_status" };
  }

  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", assignedProviderId)
    .maybeSingle();

  const conversationId = await getConversationIdForRequest(request.id);
  if (provider?.owner_id) {
    await postSystemAndNotify({
      requestId: request.id,
      actorId: authUser.id,
      conversationId,
      body: `Problem reported: ${parsed.data.note}`,
      eventType: "disputed",
      notifyUserId: provider.owner_id,
      notifyType: "disputed",
      titleKey: "notifications.disputed.title",
      bodyKey: "notifications.disputed.body",
      href: conversationId ? `/business/messages/${conversationId}` : `/business/requests/${request.id}`,
      params: { title: request.title },
    });
  }

  revalidateAfterMarketplaceWrite(request.id, "disputed");
  return { success: true, message: "disputed", conversationId: conversationId ?? undefined };
}

export async function submitReviewAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const parsed = reviewSchema.safeParse({
    requestId: formData.get("requestId"),
    rating: formData.get("rating"),
    comment: formData.get("comment") ?? "",
    recommend: formData.get("recommend") ?? "",
    anonymous: formData.get("anonymous") ?? "",
    communication: formData.get("communication") || undefined,
    quality: formData.get("quality") || undefined,
    punctuality: formData.get("punctuality") || undefined,
    professionalism: formData.get("professionalism") || undefined,
    value: formData.get("value") || undefined,
    language: formData.get("language") ?? "",
    photoKind: formData.get("photoKind") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  const recommend =
    parsed.data.recommend === "yes" ? true : parsed.data.recommend === "no" ? false : null;
  const isAnonymous = parsed.data.anonymous === "true";
  const dimensions = {
    overall: parsed.data.rating,
    communication: parsed.data.communication,
    quality: parsed.data.quality,
    punctuality: parsed.data.punctuality,
    professionalism: parsed.data.professionalism,
    value: parsed.data.value,
  };

  const photoKind =
    parsed.data.photoKind === "before" ||
    parsed.data.photoKind === "after" ||
    parsed.data.photoKind === "completed" ||
    parsed.data.photoKind === "general"
      ? parsed.data.photoKind
      : "completed";

  const photoFiles = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const { submitVerifiedReview } = await import("@/lib/reviews/service");
  const result = await submitVerifiedReview({
    customerId: authUser.id,
    serviceRequestId: parsed.data.requestId,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    recommend,
    isAnonymous,
    dimensions,
    language: parsed.data.language || undefined,
    photos: photoFiles.map((file) => ({ file, kind: photoKind })),
  });

  if (!result.ok) {
    const err = result.error;
    if (
      err === "not_found" ||
      err === "not_completed" ||
      err === "payment_pending" ||
      err === "already_reviewed" ||
      err === "not_participant"
    ) {
      return {
        success: false,
        error:
          err === "already_reviewed"
            ? "review_failed"
            : err === "payment_pending"
              ? "invalid_status"
              : err === "not_found"
                ? "not_found"
                : "invalid_status",
      };
    }
    return { success: false, error: "review_failed" };
  }

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("id, title, provider_id, lifecycle_version")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  let reviewProviderId = request?.provider_id as string | null;
  if (!reviewProviderId && request && (request.lifecycle_version ?? 1) >= 2) {
    const { resolveMarketplaceReviewProviderId } = await import(
      "@/domains/marketplace/completion"
    );
    reviewProviderId = await resolveMarketplaceReviewProviderId(request.id);
  }

  if (request && (request.lifecycle_version ?? 1) >= 2) {
    const { syncMarketplaceRequestProjection } = await import(
      "@/domains/marketplace/projection"
    );
    void syncMarketplaceRequestProjection({
      serviceRequestId: request.id,
      legacyStatus: "reviewed",
      lifecycleVersion: 2,
      phase: "completed",
    });
  }

  if (!reviewProviderId) {
    revalidateAfterMarketplaceWrite(parsed.data.requestId, "reviewed");
    return { success: true, message: result.blocked ? "review_pending" : "reviewed" };
  }

  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id, review_count, rating_avg")
    .eq("id", reviewProviderId)
    .maybeSingle();

  const conversationId = await getConversationIdForRequest(parsed.data.requestId);
  if (provider?.owner_id && request) {
    await postSystemAndNotify({
      requestId: request.id,
      actorId: authUser.id,
      conversationId,
      body: result.blocked
        ? `Review submitted (pending moderation): ${parsed.data.rating}/5`
        : `Review submitted: ${parsed.data.rating}/5`,
      eventType: "review_submitted",
      notifyUserId: provider.owner_id,
      notifyType: "new_review",
      titleKey: "notifications.newReview.title",
      bodyKey: "notifications.newReview.body",
      href: `/business/requests/${request.id}`,
      params: { title: request.title, rating: parsed.data.rating },
    });
  }

  revalidateAfterMarketplaceWrite(parsed.data.requestId, "reviewed");
  void logLearningEvent({
    eventType: "review_submitted",
    providerId: reviewProviderId,
    customerId: authUser.id,
    serviceRequestId: parsed.data.requestId,
    metadata: {
      rating: parsed.data.rating,
      blocked: result.blocked,
      reviewId: result.reviewId,
    },
  });
  try {
    const { trackBookingReviewSubmitted } = await import("@/lib/booking/completion-service");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkedBooking } = await (supabase as any)
      .from("bookings")
      .select("id")
      .eq("service_request_id", parsed.data.requestId)
      .is("deleted_at", null)
      .maybeSingle();
    await trackBookingReviewSubmitted({
      bookingId: linkedBooking?.id ?? null,
      providerId: reviewProviderId,
      actorId: authUser.id,
    });
  } catch {
    /* soft analytics */
  }
  scheduleLearningUpdate({
    providerId: reviewProviderId,
    customerId: authUser.id,
  });
  return {
    success: true,
    message: result.blocked ? "review_pending" : "reviewed",
    conversationId: conversationId ?? undefined,
  };
}
