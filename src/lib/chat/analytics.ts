import { createAdminClient } from "@/lib/supabase/admin";

export type ChatAnalyticsEvent =
  | "conversation_created"
  | "message_sent"
  | "message_read"
  | "attachment_sent"
  | "conversation_closed"
  | "first_response";

/**
 * Anonymous chat analytics — never stores message contents.
 */
export async function trackChatAnalytics(input: {
  eventType: ChatAnalyticsEvent;
  conversationId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    // New Sprint 36 table — cast until generated Database types include it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("chat_analytics_events").insert({
      event_type: input.eventType,
      conversation_id: input.conversationId ?? null,
      actor_id: input.actorId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[chat_analytics]", error);
    }
  }
}
