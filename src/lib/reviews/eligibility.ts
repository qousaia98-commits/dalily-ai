/**
 * Review eligibility — only completed bookings/requests may review.
 */

import { createClient } from "@/lib/supabase/server";
import { canReview } from "@/lib/service-requests/status-machine";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";

export type ReviewEligibility = {
  eligible: boolean;
  reason?:
    | "not_found"
    | "not_participant"
    | "not_completed"
    | "payment_pending"
    | "already_reviewed"
    | "edit_locked"
    | "provider_replied";
  serviceRequestId: string;
  providerId: string | null;
  bookingId: string | null;
  existingReviewId: string | null;
  editableUntil: string | null;
  canEdit: boolean;
};

export async function checkReviewEligibility(input: {
  customerId: string;
  serviceRequestId: string;
}): Promise<ReviewEligibility> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("service_requests")
    .select("id, customer_id, provider_id, status, lifecycle_version")
    .eq("id", input.serviceRequestId)
    .maybeSingle();

  if (!request) {
    return empty("not_found", input.serviceRequestId);
  }
  if (request.customer_id !== input.customerId) {
    return empty("not_participant", input.serviceRequestId);
  }

  let providerId = request.provider_id as string | null;
  if (!providerId && (request.lifecycle_version ?? 1) >= 2) {
    try {
      const { resolveMarketplaceReviewProviderId } = await import(
        "@/domains/marketplace/completion"
      );
      providerId = await resolveMarketplaceReviewProviderId(request.id);
    } catch {
      providerId = null;
    }
  }

  if (!canReview(request.status as ServiceRequestStatus) && request.status !== "reviewed") {
    return {
      ...empty("not_completed", input.serviceRequestId),
      providerId,
    };
  }

  // Optional payment gate (hook for future booking payment rows).
  const paymentOk = await isPaymentSatisfied(input.serviceRequestId);
  if (!paymentOk) {
    return {
      ...empty("payment_pending", input.serviceRequestId),
      providerId,
    };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("service_request_id", input.serviceRequestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bookingId =
    booking &&
    (booking.status === "completed" || booking.status === "customer_confirmed")
      ? booking.id
      : (booking?.id ?? null);

  const { data: existing } = await supabase
    .from("service_reviews")
    .select("id, editable_until, provider_reply, deleted_at")
    .eq("service_request_id", input.serviceRequestId)
    .eq("customer_id", input.customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing && request.status === "reviewed") {
    const now = Date.now();
    const until = existing.editable_until
      ? new Date(existing.editable_until).getTime()
      : 0;
    const hasReply = Boolean(existing.provider_reply);
    const canEdit = !hasReply && until > now;

    return {
      eligible: false,
      reason: hasReply
        ? "provider_replied"
        : canEdit
          ? "already_reviewed"
          : "edit_locked",
      serviceRequestId: input.serviceRequestId,
      providerId,
      bookingId,
      existingReviewId: existing.id,
      editableUntil: existing.editable_until,
      canEdit,
    };
  }

  if (existing) {
    return {
      eligible: false,
      reason: "already_reviewed",
      serviceRequestId: input.serviceRequestId,
      providerId,
      bookingId,
      existingReviewId: existing.id,
      editableUntil: existing.editable_until,
      canEdit: false,
    };
  }

  if (request.status !== "completed") {
    return {
      ...empty("not_completed", input.serviceRequestId),
      providerId,
      bookingId,
    };
  }

  return {
    eligible: true,
    serviceRequestId: input.serviceRequestId,
    providerId,
    bookingId,
    existingReviewId: null,
    editableUntil: null,
    canEdit: false,
  };
}

async function isPaymentSatisfied(serviceRequestId: string): Promise<boolean> {
  // Booking/job payments are not yet linked to service_requests in `payments`.
  // Unlock/subscription payments must not block post-job reviews.
  void serviceRequestId;
  return true;
}

function empty(
  reason: ReviewEligibility["reason"],
  serviceRequestId: string,
): ReviewEligibility {
  return {
    eligible: false,
    reason,
    serviceRequestId,
    providerId: null,
    bookingId: null,
    existingReviewId: null,
    editableUntil: null,
    canEdit: false,
  };
}

export async function getEditWindowDays(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("review_settings")
      .select("edit_window_days")
      .eq("id", "default")
      .maybeSingle();
    return data?.edit_window_days ?? 14;
  } catch {
    return 14;
  }
}

export async function getFakeRiskThreshold(): Promise<{
  block: boolean;
  threshold: number;
}> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("review_settings")
      .select("block_on_high_fake_risk, fake_risk_threshold")
      .eq("id", "default")
      .maybeSingle();
    return {
      block: data?.block_on_high_fake_risk ?? true,
      threshold: Number(data?.fake_risk_threshold ?? 0.72),
    };
  } catch {
    return { block: true, threshold: 0.72 };
  }
}
