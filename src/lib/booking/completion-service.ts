/**
 * Sprint 38 — Completion confirmation lifecycle.
 * Promotes past appointments, notifies customers, unlocks reviews only after customer YES.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingCompletionPromptEmail } from "@/lib/email/dalily-email";
import { trackBookingAnalytics } from "@/lib/booking/analytics";
import { updateBookingStatus, getBookingById } from "@/lib/booking/booking-service";
import type { Booking, BookingIssueReason } from "@/lib/booking/types";
import { BOOKING_ISSUE_REASONS } from "@/lib/booking/types";
import { setConversationFlags } from "@/lib/chat/conversation-service";

async function notifyInApp(input: {
  userId: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  href: string;
  requestId?: string | null;
  conversationId?: string | null;
}) {
  const supabase = await createClient();
  await supabase.rpc("notify_marketplace_user", {
    p_user_id: input.userId,
    p_type: input.type,
    p_title_key: input.titleKey,
    p_body_key: input.bodyKey,
    p_body_params: {},
    p_href: input.href,
    p_request_id: input.requestId ?? null,
    p_conversation_id: input.conversationId ?? null,
  });
}

async function logReminder(
  bookingId: string,
  channel: "in_app" | "email" | "push",
  metadata?: Record<string, unknown>,
) {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("booking_reminder_log").insert({
      booking_id: bookingId,
      reminder_type: "completion_prompt",
      channel,
      metadata: metadata ?? {},
    });
  } catch {
    /* soft */
  }
}

/**
 * Move confirmed bookings past ends_at → awaiting_customer_confirmation
 * and send in-app (+ email when possible) prompts. Idempotent per booking.
 */
export async function processCompletionPrompts(): Promise<{ promoted: number; notified: number }> {
  const admin = createAdminClient();

  let promoted = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any).rpc("promote_bookings_awaiting_confirmation");
    promoted = Number(data ?? 0);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("bookings")
      .update({
        status: "awaiting_customer_confirmation",
        completion_prompted_at: new Date().toISOString(),
      })
      .eq("status", "confirmed")
      .lte("ends_at", new Date().toISOString())
      .is("deleted_at", null)
      .select("id");
    promoted = (data ?? []).length;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: due } = await (admin as any)
    .from("bookings")
    .select("id, customer_id, provider_id, service_request_id, conversation_id, completion_prompted_at")
    .eq("status", "awaiting_customer_confirmation")
    .is("deleted_at", null)
    .limit(50);

  let notified = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dalily.app";

  for (const row of (due ?? []) as Array<{
    id: string;
    customer_id: string;
    provider_id: string;
    service_request_id: string | null;
    conversation_id: string | null;
  }>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin as any)
      .from("booking_reminder_log")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", row.id)
      .eq("reminder_type", "completion_prompt");

    if ((count ?? 0) > 0) continue;

    const href = `/account/bookings/${row.id}`;
    try {
      await admin.rpc("notify_marketplace_user", {
        p_user_id: row.customer_id,
        p_type: "booking_completion_prompt",
        p_title_key: "notifications.bookingCompletionPrompt.title",
        p_body_key: "notifications.bookingCompletionPrompt.body",
        p_body_params: {},
        p_href: href,
        p_request_id: row.service_request_id,
        p_conversation_id: row.conversation_id,
      });
    } catch {
      /* soft */
    }
    await logReminder(row.id, "in_app");
    await logReminder(row.id, "push", { delivered: false, reason: "push_not_configured" });

    try {
      const { data: authUser } = await admin.auth.admin.getUserById(row.customer_id);
      const email = authUser.user?.email;
      if (email) {
        const sent = await sendBookingCompletionPromptEmail({
          to: email,
          href: `${appUrl}${href}`,
        });
        await logReminder(row.id, "email", { sent: sent.sent });
      }
    } catch {
      /* soft */
    }

    await trackBookingAnalytics({
      eventType: "completion_prompt_sent",
      bookingId: row.id,
      providerId: row.provider_id,
      actorId: row.customer_id,
    });
    notified += 1;
  }

  return { promoted, notified };
}

/** Provider requests confirmation without unlocking reviews. */
export async function requestCustomerConfirmation(bookingId: string): Promise<{
  success: boolean;
  error?: string;
  booking?: Booking;
}> {
  const booking = await getBookingById(bookingId);
  if (!booking) return { success: false, error: "not_found" };
  if (booking.status !== "confirmed" && booking.status !== "issue_reported") {
    return { success: false, error: "invalid_status" };
  }

  const updated = await updateBookingStatus({
    bookingId,
    status: "awaiting_customer_confirmation",
  });
  if (!updated.success || !updated.booking) return updated;

  await notifyInApp({
    userId: booking.customerId,
    type: "booking_completion_prompt",
    titleKey: "notifications.bookingCompletionPrompt.title",
    bodyKey: "notifications.bookingCompletionPrompt.body",
    href: `/account/bookings/${bookingId}`,
    requestId: booking.serviceRequestId,
    conversationId: booking.conversationId,
  });
  await logReminder(bookingId, "in_app", { source: "provider_request" });

  return { success: true, booking: updated.booking };
}

async function ensureServiceRequestCompleted(booking: Booking): Promise<string | null> {
  const supabase = await createClient();

  if (booking.serviceRequestId) {
    await supabase
      .from("service_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", booking.serviceRequestId)
      .in("status", [
        "completed_by_business",
        "in_progress",
        "quote_accepted",
        "accepted",
        "pending",
      ]);
    return booking.serviceRequestId;
  }

  // Create a minimal completed request so existing Reviews module can unlock
  const { data: created } = await supabase
    .from("service_requests")
    .insert({
      customer_id: booking.customerId,
      provider_id: booking.providerId,
      title: "Booked appointment",
      description: booking.customerNotes?.trim() || "Completed booked appointment",
      location_text: booking.locationText,
      status: "completed",
      accepted_at: booking.confirmedAt ?? booking.createdAt,
      completed_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (created?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("bookings")
      .update({ service_request_id: created.id })
      .eq("id", booking.id);
    return created.id;
  }
  return null;
}

export async function customerConfirmCompletion(input: {
  bookingId: string;
  customerId: string;
  archiveConversation?: boolean;
}): Promise<{ success: boolean; error?: string; serviceRequestId?: string | null }> {
  const booking = await getBookingById(input.bookingId);
  if (!booking) return { success: false, error: "not_found" };
  if (booking.customerId !== input.customerId) return { success: false, error: "forbidden" };
  if (
    booking.status !== "awaiting_customer_confirmation" &&
    booking.status !== "confirmed" &&
    booking.status !== "issue_reported"
  ) {
    return { success: false, error: "invalid_status" };
  }

  // Audit: customer_confirmed → completed
  await updateBookingStatus({ bookingId: input.bookingId, status: "customer_confirmed" });
  const completed = await updateBookingStatus({
    bookingId: input.bookingId,
    status: "completed",
    patch: { customer_confirmed_at: new Date().toISOString() },
  });
  if (!completed.success) return { success: false, error: completed.error };

  const serviceRequestId = await ensureServiceRequestCompleted({
    ...booking,
    serviceRequestId: booking.serviceRequestId,
  });

  const delayMs = booking.endsAt
    ? Math.max(0, Date.now() - new Date(booking.endsAt).getTime())
    : null;

  await trackBookingAnalytics({
    eventType: "completion_confirmed",
    bookingId: input.bookingId,
    providerId: booking.providerId,
    actorId: input.customerId,
    metadata: delayMs != null ? { confirmationDelayMs: delayMs } : {},
  });
  await trackBookingAnalytics({
    eventType: "booking_completed",
    bookingId: input.bookingId,
    providerId: booking.providerId,
    actorId: input.customerId,
  });

  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", booking.providerId)
    .maybeSingle();

  if (provider?.owner_id) {
    await notifyInApp({
      userId: provider.owner_id,
      type: "booking_customer_confirmed",
      titleKey: "notifications.bookingCustomerConfirmed.title",
      bodyKey: "notifications.bookingCustomerConfirmed.body",
      href: `/business/bookings/${input.bookingId}`,
      requestId: serviceRequestId,
      conversationId: booking.conversationId,
    });
  }

  if (input.archiveConversation !== false && booking.conversationId) {
    try {
      await setConversationFlags({
        conversationId: booking.conversationId,
        viewer: "customer",
        archived: true,
      });
    } catch {
      /* optional */
    }
  }

  return { success: true, serviceRequestId };
}

export async function customerReportIssue(input: {
  bookingId: string;
  customerId: string;
  reason: BookingIssueReason;
}): Promise<{ success: boolean; error?: string }> {
  if (!BOOKING_ISSUE_REASONS.includes(input.reason)) {
    return { success: false, error: "validation_error" };
  }

  const booking = await getBookingById(input.bookingId);
  if (!booking) return { success: false, error: "not_found" };
  if (booking.customerId !== input.customerId) return { success: false, error: "forbidden" };
  if (
    booking.status !== "awaiting_customer_confirmation" &&
    booking.status !== "confirmed" &&
    booking.status !== "issue_reported"
  ) {
    return { success: false, error: "invalid_status" };
  }

  const updated = await updateBookingStatus({
    bookingId: input.bookingId,
    status: "issue_reported",
    patch: {
      issue_reason: input.reason,
      issue_reported_at: new Date().toISOString(),
    },
  });
  if (!updated.success) return { success: false, error: updated.error };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("booking_issue_reports").insert({
    booking_id: input.bookingId,
    customer_id: input.customerId,
    provider_id: booking.providerId,
    reason: input.reason,
  });

  await trackBookingAnalytics({
    eventType: "issue_reported",
    bookingId: input.bookingId,
    providerId: booking.providerId,
    actorId: input.customerId,
    metadata: { reason: input.reason },
  });

  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", booking.providerId)
    .maybeSingle();

  if (provider?.owner_id) {
    await notifyInApp({
      userId: provider.owner_id,
      type: "booking_issue_reported",
      titleKey: "notifications.bookingIssueReported.title",
      bodyKey: "notifications.bookingIssueReported.body",
      href: `/business/bookings/${input.bookingId}`,
      requestId: booking.serviceRequestId,
      conversationId: booking.conversationId,
    });
  }

  return { success: true };
}

export async function trackBookingReviewSubmitted(input: {
  bookingId?: string | null;
  providerId: string;
  actorId: string;
}): Promise<void> {
  await trackBookingAnalytics({
    eventType: "review_submitted",
    bookingId: input.bookingId ?? null,
    providerId: input.providerId,
    actorId: input.actorId,
  });
}
