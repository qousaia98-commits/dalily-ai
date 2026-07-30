/**
 * Load booking timeline for a conversation (server).
 */

import { createClient } from "@/lib/supabase/server";
import { buildCommunicationTimeline } from "./timeline";
import type { CommunicationTimelineItem } from "./types";

export async function loadConversationTimeline(input: {
  conversationId: string;
  serviceRequestId: string | null;
}): Promise<CommunicationTimelineItem[]> {
  if (!input.serviceRequestId) return [];

  const supabase = await createClient();

  const [{ data: request }, { data: booking }, { data: messages }, { data: review }] =
    await Promise.all([
      supabase
        .from("service_requests")
        .select("id, status")
        .eq("id", input.serviceRequestId)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("bookings")
        .select("id, starts_at, status, completed_at")
        .eq("service_request_id", input.serviceRequestId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("event_type, created_at, is_system")
        .eq("conversation_id", input.conversationId)
        .eq("is_system", true)
        .order("created_at", { ascending: true })
        .limit(80),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("service_reviews")
        .select("id")
        .eq("service_request_id", input.serviceRequestId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle(),
    ]);

  const systemEvents = ((messages ?? []) as Array<{
    event_type?: string | null;
    created_at: string;
    is_system?: boolean;
  }>).map((m) => ({
    eventType: m.event_type ?? null,
    createdAt: m.created_at,
  }));

  return buildCommunicationTimeline({
    requestStatus: (request?.status as string | null) ?? null,
    hasOfferSelected: ["quote_accepted", "accepted", "in_progress", "completed", "reviewed"].includes(
      String(request?.status ?? ""),
    ),
    hasBooking: Boolean(booking?.id),
    bookingStartsAt: (booking?.starts_at as string | null) ?? null,
    completedAt: (booking?.completed_at as string | null) ?? null,
    hasReview: Boolean(review?.id),
    hasPayment: false,
    systemEvents,
  });
}
