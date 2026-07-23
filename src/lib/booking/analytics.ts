import { createAdminClient } from "@/lib/supabase/admin";

export type BookingAnalyticsEvent =
  | "booking_created"
  | "booking_accepted"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_completed"
  | "booking_rescheduled"
  | "booking_expired"
  | "completion_confirmed"
  | "issue_reported"
  | "review_submitted"
  | "completion_prompt_sent";

/** Anonymous booking analytics — no personal booking content. */
export async function trackBookingAnalytics(input: {
  eventType: BookingAnalyticsEvent;
  bookingId?: string | null;
  providerId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("booking_analytics_events").insert({
      event_type: input.eventType,
      booking_id: input.bookingId ?? null,
      provider_id: input.providerId ?? null,
      actor_id: input.actorId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[booking_analytics]", error);
    }
  }
}
