"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/providers/constants";
import {
  MAX_REQUEST_PHOTOS,
  SERVICE_REQUEST_MEDIA_BUCKET,
} from "@/lib/service-requests/constants";
import { buildServiceRequestMediaPath } from "@/lib/service-requests/storage";
import {
  getProviderRequestSettings,
  hasPendingRequest,
} from "@/lib/service-requests/queries";
import {
  canCompleteService,
  canConfirmCompletion,
  canDecideQuote,
  canReview,
  canSendQuote,
} from "@/lib/service-requests/status-machine";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import {
  createQuoteSchema,
  createServiceRequestSchema,
  disputeSchema,
  providerRequestSettingsSchema,
  reviewSchema,
  sendMessageSchema,
} from "@/lib/validations/service-request";
import { logLearningEvent, scheduleLearningUpdate } from "@/lib/search/learning";

export type ServiceRequestActionState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  requestId?: string;
  conversationId?: string;
};

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return {
    success: false,
    error: "validation_error" as const,
    fieldErrors: error.flatten().fieldErrors,
  };
}

function revalidateMessaging() {
  revalidatePath("/messages");
  revalidatePath("/business/messages");
  revalidatePath("/business/requests");
  revalidatePath("/account/requests");
  revalidatePath("/admin/marketplace");
  revalidatePath("/", "layout");
  revalidatePath("/business", "layout");
}

async function getConversationIdForRequest(requestId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("service_request_id", requestId)
    .maybeSingle();
  return data?.id ?? null;
}

async function postSystemAndNotify(input: {
  requestId: string;
  actorId: string;
  conversationId: string | null;
  body: string;
  eventType: string;
  notifyUserId: string;
  notifyType: string;
  titleKey: string;
  bodyKey: string;
  href: string;
  params?: Record<string, string | number>;
}) {
  const supabase = await createClient();
  if (input.conversationId) {
    await supabase.rpc("post_system_message", {
      p_conversation_id: input.conversationId,
      p_actor_id: input.actorId,
      p_body: input.body,
      p_event_type: input.eventType,
    });
  }
  await supabase.rpc("notify_marketplace_user", {
    p_user_id: input.notifyUserId,
    p_type: input.notifyType,
    p_title_key: input.titleKey,
    p_body_key: input.bodyKey,
    p_body_params: input.params ?? {},
    p_href: input.href,
    p_request_id: input.requestId,
    p_conversation_id: input.conversationId,
  });
}

export async function createServiceRequestAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const parsed = createServiceRequestSchema.safeParse({
    providerId: formData.get("providerId"),
    title: formData.get("title"),
    description: formData.get("description"),
    preferredDate: formData.get("preferredDate") ?? "",
    preferredTime: formData.get("preferredTime") ?? "",
    budget: formData.get("budget") ?? "",
    locationText: formData.get("locationText") ?? "",
  });

  if (!parsed.success) return validationError(parsed.error);

  const settings = await getProviderRequestSettings(parsed.data.providerId);
  if (!settings.accepting_requests || settings.vacation_mode) {
    return { success: false, error: "not_accepting" };
  }

  const pending = await hasPendingRequest(authUser.id, parsed.data.providerId);
  if (pending) return { success: false, error: "pending_exists" };

  const supabase = await createClient();
  const { count: pendingCount } = await supabase
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", parsed.data.providerId)
    .eq("status", "pending");

  if ((pendingCount ?? 0) >= settings.max_pending_requests) {
    return { success: false, error: "provider_at_capacity" };
  }

  const budgetRaw = parsed.data.budget?.trim();
  const budget =
    budgetRaw && budgetRaw.length > 0 && !Number.isNaN(Number(budgetRaw))
      ? Number(budgetRaw)
      : null;

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id, status, owner_id")
    .eq("id", parsed.data.providerId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (providerError || !provider) return { success: false, error: "provider_not_found" };
  if (provider.owner_id === authUser.id) {
    return { success: false, error: "self_request" };
  }

  const { data: request, error: insertError } = await supabase
    .from("service_requests")
    .insert({
      customer_id: authUser.id,
      provider_id: parsed.data.providerId,
      title: parsed.data.title,
      description: parsed.data.description,
      preferred_date: parsed.data.preferredDate?.trim() || null,
      preferred_time: parsed.data.preferredTime?.trim() || null,
      budget,
      location_text: parsed.data.locationText?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !request) {
    if (insertError?.code === "23505") return { success: false, error: "pending_exists" };
    return { success: false, error: "create_failed" };
  }

  const photoFiles = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_REQUEST_PHOTOS);

  for (let i = 0; i < photoFiles.length; i++) {
    const file = photoFiles[i];
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) continue;
    if (file.size > MAX_IMAGE_BYTES) continue;

    const path = buildServiceRequestMediaPath(authUser.id, request.id, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) continue;

    await supabase.from("service_request_images").insert({
      request_id: request.id,
      bucket: SERVICE_REQUEST_MEDIA_BUCKET,
      path,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: i,
    });
  }

  if (provider.owner_id) {
    await supabase.rpc("notify_marketplace_user", {
      p_user_id: provider.owner_id,
      p_type: "new_request",
      p_title_key: "notifications.newRequest.title",
      p_body_key: "notifications.newRequest.body",
      p_body_params: { title: parsed.data.title },
      p_href: `/business/requests/${request.id}`,
      p_request_id: request.id,
      p_conversation_id: null,
    });
  }

  revalidateMessaging();
  void logLearningEvent({
    eventType: "request_sent",
    providerId: provider.id,
    customerId: authUser.id,
    serviceRequestId: request.id,
  });
  // Repeat booking signal when customer had a prior completed job with this provider
  void (async () => {
    try {
      const { count } = await supabase
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", authUser.id)
        .eq("provider_id", provider.id)
        .in("status", ["completed", "reviewed"])
        .neq("id", request.id);
      if ((count ?? 0) > 0) {
        await logLearningEvent({
          eventType: "repeat_booking",
          providerId: provider.id,
          customerId: authUser.id,
          serviceRequestId: request.id,
        });
      }
    } catch {
      // non-blocking
    }
  })();
  scheduleLearningUpdate({ providerId: provider.id, customerId: authUser.id });
  return { success: true, message: "request_sent", requestId: request.id };
}

export async function acceptServiceRequestAction(
  requestId: string,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_service_request", {
    p_request_id: requestId,
    p_actor_id: authUser.id,
  });

  if (error) {
    if (error.message.includes("request_not_pending")) return { success: false, error: "not_pending" };
    if (error.message.includes("forbidden")) return { success: false, error: "forbidden" };
    return { success: false, error: "accept_failed" };
  }

  revalidateMessaging();
  void logLearningEvent({
    eventType: "request_accepted",
    providerId: provider.id,
    serviceRequestId: requestId,
    customerId: authUser.id,
  });
  scheduleLearningUpdate({ providerId: provider.id });
  return { success: true, message: "accepted", conversationId: data as string };
}

export async function rejectServiceRequestAction(
  requestId: string,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_service_request", {
    p_request_id: requestId,
    p_actor_id: authUser.id,
  });

  if (error) {
    if (error.message.includes("request_not_pending")) return { success: false, error: "not_pending" };
    return { success: false, error: "reject_failed" };
  }

  revalidateMessaging();
  void logLearningEvent({
    eventType: "request_declined",
    providerId: provider.id,
    serviceRequestId: requestId,
    customerId: authUser.id,
  });
  scheduleLearningUpdate({ providerId: provider.id });
  return { success: true, message: "rejected" };
}

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

  revalidateMessaging();
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

  revalidateMessaging();
  return { success: true, message: decision, conversationId: conversationId ?? undefined };
}

export async function completeServiceAction(requestId: string): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!request) return { success: false, error: "not_found" };
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

  revalidateMessaging();
  return { success: true, message: "completed_by_business", conversationId: conversationId ?? undefined };
}

export async function confirmCompletionAction(
  requestId: string,
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

  revalidateMessaging();
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

  const { data: updated, error: updateError } = await supabase
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
    .eq("id", request.provider_id)
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

  revalidateMessaging();
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
  if (!canReview(request.status as ServiceRequestStatus)) {
    return { success: false, error: "invalid_status" };
  }

  const recommend =
    parsed.data.recommend === "yes" ? true : parsed.data.recommend === "no" ? false : null;

  const { data: review, error } = await supabase
    .from("service_reviews")
    .insert({
      service_request_id: request.id,
      provider_id: request.provider_id,
      customer_id: authUser.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment?.trim() || null,
      recommend,
    })
    .select("id")
    .single();

  if (error || !review) return { success: false, error: "review_failed" };

  const { data: reviewed, error: reviewStatusError } = await supabase
    .from("service_requests")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();

  if (reviewStatusError || !reviewed) {
    return { success: false, error: "invalid_status" };
  }

  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id, review_count, rating_avg")
    .eq("id", request.provider_id)
    .maybeSingle();

  if (provider) {
    const prevCount = provider.review_count ?? 0;
    const prevAvg = Number(provider.rating_avg ?? 0);
    const nextCount = prevCount + 1;
    const nextAvg = ((prevAvg * prevCount) + parsed.data.rating) / nextCount;
    await supabase
      .from("providers")
      .update({ review_count: nextCount, rating_avg: nextAvg })
      .eq("id", request.provider_id);
  }

  const conversationId = await getConversationIdForRequest(request.id);
  if (provider?.owner_id) {
    await postSystemAndNotify({
      requestId: request.id,
      actorId: authUser.id,
      conversationId,
      body: `Review submitted: ${parsed.data.rating}/5`,
      eventType: "review_submitted",
      notifyUserId: provider.owner_id,
      notifyType: "new_review",
      titleKey: "notifications.newReview.title",
      bodyKey: "notifications.newReview.body",
      href: `/business/requests/${request.id}`,
      params: { title: request.title, rating: parsed.data.rating },
    });
  }

  revalidateMessaging();
  void logLearningEvent({
    eventType: "review_submitted",
    providerId: request.provider_id,
    customerId: authUser.id,
    serviceRequestId: request.id,
    metadata: { rating: parsed.data.rating },
  });
  scheduleLearningUpdate({
    providerId: request.provider_id,
    customerId: authUser.id,
  });
  return { success: true, message: "reviewed" };
}

export async function sendMessageAction(
  conversationId: string,
  bodyText: string,
): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const parsed = sendMessageSchema.safeParse({ conversationId, bodyText });
  if (!parsed.success) return { success: false, error: "validation_error" };

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, provider_id, customer_id, service_request_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return { success: false, error: "not_found" };

  const { data: providerRow } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();

  const isParticipant =
    authUser.id === conv.customer_id || authUser.id === providerRow?.owner_id;
  if (!isParticipant) return { success: false, error: "forbidden" };

  if (conv.service_request_id) {
    const { data: request } = await supabase
      .from("service_requests")
      .select("status")
      .eq("id", conv.service_request_id)
      .maybeSingle();
    if (
      !request ||
      request.status === "pending" ||
      request.status === "rejected" ||
      request.status === "cancelled" ||
      request.status === "reviewed"
    ) {
      return { success: false, error: "chat_locked" };
    }
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: parsed.data.conversationId,
    sender_id: authUser.id,
    body_text: parsed.data.bodyText,
    is_system: false,
  });
  if (error) return { success: false, error: "send_failed" };

  const notifyUserId =
    authUser.id === conv.customer_id ? providerRow?.owner_id : conv.customer_id;

  if (notifyUserId) {
    await supabase.rpc("notify_marketplace_user", {
      p_user_id: notifyUserId,
      p_type: "new_message",
      p_title_key: "notifications.newMessage.title",
      p_body_key: "notifications.newMessage.body",
      p_body_params: {},
      p_href:
        authUser.id === conv.customer_id
          ? `/business/messages/${conversationId}`
          : `/messages/${conversationId}`,
      p_request_id: conv.service_request_id,
      p_conversation_id: conversationId,
    });
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/business/messages/${conversationId}`);
  revalidatePath("/messages");
  revalidatePath("/business/messages");
  return { success: true };
}

export async function saveProviderRequestSettingsAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const parsed = providerRequestSettingsSchema.safeParse({
    acceptingRequests: formData.get("acceptingRequests") === "on" || formData.get("acceptingRequests") === "true",
    maxPendingRequests: formData.get("maxPendingRequests"),
    autoRejectMessage: formData.get("autoRejectMessage") ?? "",
    vacationMode: formData.get("vacationMode") === "on" || formData.get("vacationMode") === "true",
    estimatedResponseHours: formData.get("estimatedResponseHours"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("provider_request_settings").upsert({
    provider_id: provider.id,
    accepting_requests: parsed.data.acceptingRequests,
    max_pending_requests: parsed.data.maxPendingRequests,
    auto_reject_message: parsed.data.autoRejectMessage?.trim() || null,
    vacation_mode: parsed.data.vacationMode,
    estimated_response_hours: parsed.data.estimatedResponseHours,
  });

  if (error) return { success: false, error: "settings_failed" };
  revalidatePath("/business/settings");
  revalidatePath("/business/account");
  return { success: true, message: "settings_saved" };
}

export async function markNotificationReadAction(notificationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const supabase = await createClient();
  await supabase
    .from("marketplace_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", authUser.id);
  revalidatePath("/", "layout");
  return { success: true };
}
