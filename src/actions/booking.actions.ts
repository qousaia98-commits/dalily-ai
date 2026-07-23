"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import { getOrCreateConversationForRequest } from "@/lib/chat/conversation-service";
import { trackBookingAnalytics } from "@/lib/booking/analytics";
import {
  createBooking,
  getBookingById,
  listCustomerBookings,
  listProviderBookings,
  updateBookingStatus,
} from "@/lib/booking/booking-service";
import {
  createBlockedTime,
  getAvailabilitySettings,
  upsertAvailabilitySettings,
} from "@/lib/booking/availability-service";
import { generateAvailableSlots } from "@/lib/booking/slot-service";
import type {
  AvailabilitySettings,
  BookingDurationMinutes,
  PreferredContact,
} from "@/lib/booking/types";
import { BOOKING_DURATIONS } from "@/lib/booking/types";

function revalidateBookingPaths(providerId?: string) {
  revalidatePath("/business/bookings");
  revalidatePath("/business/calendar");
  revalidatePath("/account/bookings");
  revalidatePath("/business", "layout");
  if (providerId) revalidatePath(`/providers/${providerId}`);
}

async function notifyBooking(input: {
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

async function postBookingSystemMessage(
  conversationId: string | null | undefined,
  actorId: string,
  body: string,
) {
  if (!conversationId) return;
  const supabase = await createClient();
  try {
    await supabase.rpc("post_system_message", {
      p_conversation_id: conversationId,
      p_actor_id: actorId,
      p_body: body,
      p_event_type: "booking_update",
    });
  } catch {
    /* soft — chat core untouched if RPC fails */
  }
}

export async function fetchAvailableSlotsAction(input: {
  providerId: string;
  fromDate: string;
  durationMinutes: number;
  days?: number;
}) {
  const duration = input.durationMinutes as BookingDurationMinutes;
  if (!BOOKING_DURATIONS.includes(duration)) {
    return { success: false as const, slots: [], error: "invalid_duration" };
  }
  const slots = await generateAvailableSlots({
    providerId: input.providerId,
    fromDate: input.fromDate,
    durationMinutes: duration,
    days: input.days ?? 14,
  });
  return { success: true as const, slots };
}

export async function createBookingAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  bookingId?: string;
}> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const providerId = String(formData.get("providerId") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes")) as BookingDurationMinutes;
  const serviceId = String(formData.get("serviceId") ?? "") || null;
  const serviceRequestId = String(formData.get("serviceRequestId") ?? "") || null;
  const locationText = String(formData.get("locationText") ?? "") || null;
  const customerNotes = String(formData.get("customerNotes") ?? "") || null;
  const preferredContact = (String(formData.get("preferredContact") ?? "") ||
    null) as PreferredContact | null;

  if (!providerId || !startsAt || !endsAt || !BOOKING_DURATIONS.includes(durationMinutes)) {
    return { success: false, error: "validation_error" };
  }

  let conversationId: string | null = null;
  if (serviceRequestId) {
    const linked = await getOrCreateConversationForRequest({
      serviceRequestId,
      providerId,
      customerId: authUser.id,
    });
    conversationId = linked?.conversationId ?? null;
  }

  const created = await createBooking({
    providerId,
    customerId: authUser.id,
    serviceId,
    serviceRequestId,
    conversationId,
    startsAt,
    endsAt,
    durationMinutes,
    locationText,
    customerNotes,
    preferredContact,
  });

  if (!created.success) return { success: false, error: created.error };

  await trackBookingAnalytics({
    eventType: "booking_created",
    bookingId: created.booking.id,
    providerId,
    actorId: authUser.id,
    metadata: { durationMinutes },
  });

  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", providerId)
    .maybeSingle();

  if (provider?.owner_id) {
    await notifyBooking({
      userId: provider.owner_id,
      type: "booking_created",
      titleKey: "notifications.bookingCreated.title",
      bodyKey: "notifications.bookingCreated.body",
      href: `/business/bookings/${created.booking.id}`,
      requestId: serviceRequestId,
      conversationId,
    });
  }

  await postBookingSystemMessage(
    conversationId,
    authUser.id,
    "A new appointment was requested.",
  );

  revalidateBookingPaths(providerId);
  return { success: true, bookingId: created.booking.id };
}

export async function acceptBookingAction(bookingId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const booking = await getBookingById(bookingId);
  if (!booking || booking.providerId !== provider.id) {
    return { success: false, error: "not_found" };
  }
  if (booking.status !== "pending" && booking.status !== "rescheduled") {
    return { success: false, error: "invalid_status" };
  }

  const updated = await updateBookingStatus({ bookingId, status: "confirmed" });
  if (!updated.success) return updated;

  await trackBookingAnalytics({
    eventType: "booking_accepted",
    bookingId,
    providerId: provider.id,
    actorId: authUser.id,
  });

  await notifyBooking({
    userId: booking.customerId,
    type: "booking_accepted",
    titleKey: "notifications.bookingAccepted.title",
    bodyKey: "notifications.bookingAccepted.body",
    href: `/account/bookings/${bookingId}`,
    requestId: booking.serviceRequestId,
    conversationId: booking.conversationId,
  });
  await postBookingSystemMessage(booking.conversationId, authUser.id, "Appointment confirmed.");

  revalidateBookingPaths(provider.id);
  return { success: true };
}

export async function declineBookingAction(bookingId: string, reason?: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const booking = await getBookingById(bookingId);
  if (!booking || booking.providerId !== provider.id) {
    return { success: false, error: "not_found" };
  }

  const updated = await updateBookingStatus({
    bookingId,
    status: "declined",
    patch: { declined_reason: reason ?? null },
  });
  if (!updated.success) return updated;

  await trackBookingAnalytics({
    eventType: "booking_declined",
    bookingId,
    providerId: provider.id,
    actorId: authUser.id,
  });

  await notifyBooking({
    userId: booking.customerId,
    type: "booking_declined",
    titleKey: "notifications.bookingDeclined.title",
    bodyKey: "notifications.bookingDeclined.body",
    href: `/account/bookings/${bookingId}`,
    requestId: booking.serviceRequestId,
    conversationId: booking.conversationId,
  });
  await postBookingSystemMessage(booking.conversationId, authUser.id, "Appointment declined.");

  revalidateBookingPaths(provider.id);
  return { success: true };
}

export async function cancelBookingAction(bookingId: string, reason?: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const booking = await getBookingById(bookingId);
  if (!booking) return { success: false, error: "not_found" };

  const provider = await getOwnedProvider(authUser.id);
  const isCustomer = booking.customerId === authUser.id;
  const isProvider = provider?.id === booking.providerId;
  if (!isCustomer && !isProvider) return { success: false, error: "forbidden" };

  const updated = await updateBookingStatus({
    bookingId,
    status: "cancelled",
    patch: { cancelled_by: authUser.id, cancel_reason: reason ?? null },
  });
  if (!updated.success) return updated;

  await trackBookingAnalytics({
    eventType: "booking_cancelled",
    bookingId,
    providerId: booking.providerId,
    actorId: authUser.id,
  });

  const supabase = await createClient();
  let notifyUserId: string | null | undefined = booking.customerId;
  if (isCustomer) {
    const { data: providerRow } = await supabase
      .from("providers")
      .select("owner_id")
      .eq("id", booking.providerId)
      .maybeSingle();
    notifyUserId = providerRow?.owner_id;
  }

  if (notifyUserId) {
    await notifyBooking({
      userId: notifyUserId,
      type: "booking_cancelled",
      titleKey: "notifications.bookingCancelled.title",
      bodyKey: "notifications.bookingCancelled.body",
      href: isCustomer ? `/business/bookings/${bookingId}` : `/account/bookings/${bookingId}`,
      requestId: booking.serviceRequestId,
      conversationId: booking.conversationId,
    });
  }
  await postBookingSystemMessage(booking.conversationId, authUser.id, "Appointment cancelled.");

  revalidateBookingPaths(booking.providerId);
  return { success: true };
}

export async function completeBookingAction(bookingId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const booking = await getBookingById(bookingId);
  if (!booking || booking.providerId !== provider.id) {
    return { success: false, error: "not_found" };
  }

  const { requestCustomerConfirmation } = await import("@/lib/booking/completion-service");
  const result = await requestCustomerConfirmation(bookingId);
  if (!result.success) return result;

  await postBookingSystemMessage(
    booking.conversationId,
    authUser.id,
    "Provider marked the job done. Please confirm whether the service was completed.",
  );

  revalidateBookingPaths(provider.id);
  return { success: true };
}

export async function customerConfirmCompletionAction(bookingId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const { customerConfirmCompletion } = await import("@/lib/booking/completion-service");
  const result = await customerConfirmCompletion({
    bookingId,
    customerId: authUser.id,
    archiveConversation: true,
  });
  if (!result.success) return result;

  const booking = await getBookingById(bookingId);
  if (booking) {
    await postBookingSystemMessage(
      booking.conversationId,
      authUser.id,
      "Customer confirmed the service was completed. You can leave a review.",
    );
  }

  revalidateBookingPaths(booking?.providerId);
  revalidatePath("/account/requests");
  return { success: true, serviceRequestId: result.serviceRequestId };
}

export async function customerReportIssueAction(bookingId: string, reason: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const { customerReportIssue } = await import("@/lib/booking/completion-service");
  const result = await customerReportIssue({
    bookingId,
    customerId: authUser.id,
    reason: reason as import("@/lib/booking/types").BookingIssueReason,
  });
  if (!result.success) return result;

  const booking = await getBookingById(bookingId);
  if (booking) {
    await postBookingSystemMessage(
      booking.conversationId,
      authUser.id,
      `Customer reported an issue with the appointment (${reason}). Chat stays open — you can reschedule.`,
    );
  }

  revalidateBookingPaths(booking?.providerId);
  return { success: true };
}

export async function processBookingCompletionPromptsAction() {
  const { processCompletionPrompts } = await import("@/lib/booking/completion-service");
  return processCompletionPrompts();
}

export async function rescheduleBookingAction(formData: FormData) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const bookingId = String(formData.get("bookingId") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes")) as BookingDurationMinutes;

  const booking = await getBookingById(bookingId);
  if (!booking) return { success: false, error: "not_found" };

  const provider = await getOwnedProvider(authUser.id);
  const allowed =
    booking.customerId === authUser.id || provider?.id === booking.providerId;
  if (!allowed) return { success: false, error: "forbidden" };

  const updated = await updateBookingStatus({
    bookingId,
    status: "rescheduled",
    patch: {
      starts_at: startsAt,
      ends_at: endsAt,
      duration_minutes: durationMinutes,
      confirmed_at: null,
    },
  });
  if (!updated.success) return updated;

  await trackBookingAnalytics({
    eventType: "booking_rescheduled",
    bookingId,
    providerId: booking.providerId,
    actorId: authUser.id,
  });

  revalidateBookingPaths(booking.providerId);
  return { success: true };
}

export async function saveAvailabilitySettingsAction(formData: FormData) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const durations = String(formData.get("slotDurations") ?? "30,60")
    .split(",")
    .map(Number)
    .filter((d) => BOOKING_DURATIONS.includes(d as BookingDurationMinutes)) as BookingDurationMinutes[];

  const settings: AvailabilitySettings = {
    providerId: provider.id,
    timezone: String(formData.get("timezone") ?? "Asia/Damascus"),
    slotDurations: durations.length ? durations : [30, 60],
    bufferMinutes: Number(formData.get("bufferMinutes") ?? 0),
    minNoticeHours: Number(formData.get("minNoticeHours") ?? 2),
    maxDaysAhead: Number(formData.get("maxDaysAhead") ?? 60),
    emergencyAvailable: formData.has("emergencyAvailable"),
    acceptingBookings: formData.has("acceptingBookings"),
  };

  const result = await upsertAvailabilitySettings(settings);
  revalidateBookingPaths(provider.id);
  return result;
}

export async function blockTimeAction(formData: FormData) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const result = await createBlockedTime({
    providerId: provider.id,
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    reason: String(formData.get("reason") ?? "") || undefined,
    kind: (String(formData.get("kind") ?? "blocked") as "blocked" | "vacation" | "holiday" | "manual"),
    createdBy: authUser.id,
  });
  revalidateBookingPaths(provider.id);
  return result;
}

export async function loadMyBookingsAction(viewer: "customer" | "business") {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, bookings: [] };

  if (viewer === "customer") {
    const bookings = await listCustomerBookings(authUser.id);
    return { success: true as const, bookings };
  }

  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false as const, bookings: [] };
  const bookings = await listProviderBookings(provider.id);
  return { success: true as const, bookings };
}

export async function getAvailabilitySettingsAction() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return null;
  return getAvailabilitySettings(provider.id);
}
