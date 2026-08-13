/**
 * Smart appointment reminders — 24h, 2h, on-the-way window, change notices.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

type ReminderType =
  | "24h"
  | "2h"
  | "on_the_way"
  | "appointment_changed"
  | "after_completion";

async function alreadySent(
  bookingId: string,
  reminderType: ReminderType,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin as any)
      .from("booking_reminder_log")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("reminder_type", reminderType);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

async function logAndNotify(input: {
  bookingId: string;
  customerId: string;
  providerId: string;
  reminderType: ReminderType;
  titleKey: string;
  bodyKey: string;
  href: string;
  serviceRequestId?: string | null;
  conversationId?: string | null;
}) {
  const admin = createAdminClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("booking_reminder_log").insert({
      booking_id: input.bookingId,
      reminder_type: input.reminderType,
      channel: "in_app",
      metadata: {},
    });
  } catch {
    /* soft */
  }

  try {
    await admin.rpc("notify_marketplace_user", {
      p_user_id: input.customerId,
      p_type: `booking_reminder_${input.reminderType}`,
      p_title_key: input.titleKey,
      p_body_key: input.bodyKey,
      p_body_params: {},
      p_href: input.href,
      p_request_id: input.serviceRequestId ?? null,
      p_conversation_id: input.conversationId ?? null,
    });
  } catch {
    /* soft */
  }

  void emitAiLearningEvent({
    eventType: "booking_reminder_sent",
    providerId: input.providerId,
    customerId: input.customerId,
    serviceRequestId: input.serviceRequestId,
    metadata: {
      bookingId: input.bookingId,
      reminderType: input.reminderType,
    },
  });
}

/**
 * Process due pre-appointment reminders. Idempotent via booking_reminder_log.
 */
export async function processSmartBookingReminders(): Promise<{
  sent24h: number;
  sent2h: number;
  sentOnWay: number;
}> {
  const admin = createAdminClient();
  const now = Date.now();
  let sent24h = 0;
  let sent2h = 0;
  let sentOnWay = 0;

  try {
    const windowEnd = new Date(now + 26 * 3600_000).toISOString();
    const { data: upcoming } = await admin
      .from("bookings")
      .select(
        "id, provider_id, customer_id, starts_at, ends_at, status, service_request_id, conversation_id",
      )
      .in("status", ["confirmed", "pending"])
      .is("deleted_at", null)
      .gte("starts_at", new Date(now).toISOString())
      .lte("starts_at", windowEnd)
      .limit(200);

    for (const row of upcoming ?? []) {
      const starts = new Date(row.starts_at as string).getTime();
      const hoursUntil = (starts - now) / 3600_000;
      const bookingId = row.id as string;
      const customerId = row.customer_id as string;
      const providerId = row.provider_id as string;
      const href = `/account/bookings/${bookingId}`;

      if (hoursUntil <= 24 && hoursUntil > 22) {
        if (!(await alreadySent(bookingId, "24h"))) {
          await logAndNotify({
            bookingId,
            customerId,
            providerId,
            reminderType: "24h",
            titleKey: "booking.reminders.title24h",
            bodyKey: "booking.reminders.body24h",
            href,
            serviceRequestId: row.service_request_id as string | null,
            conversationId: row.conversation_id as string | null,
          });
          sent24h += 1;
        }
      }

      if (hoursUntil <= 2 && hoursUntil > 1.5) {
        if (!(await alreadySent(bookingId, "2h"))) {
          await logAndNotify({
            bookingId,
            customerId,
            providerId,
            reminderType: "2h",
            titleKey: "booking.reminders.title2h",
            bodyKey: "booking.reminders.body2h",
            href,
            serviceRequestId: row.service_request_id as string | null,
            conversationId: row.conversation_id as string | null,
          });
          sent2h += 1;
        }
      }

      if (hoursUntil <= 40 / 60 && hoursUntil > 15 / 60) {
        if (!(await alreadySent(bookingId, "on_the_way"))) {
          await logAndNotify({
            bookingId,
            customerId,
            providerId,
            reminderType: "on_the_way",
            titleKey: "booking.reminders.titleOnWay",
            bodyKey: "booking.reminders.bodyOnWay",
            href,
            serviceRequestId: row.service_request_id as string | null,
            conversationId: row.conversation_id as string | null,
          });
          sentOnWay += 1;
        }
      }
    }
  } catch {
    // soft
  }

  return { sent24h, sent2h, sentOnWay };
}
