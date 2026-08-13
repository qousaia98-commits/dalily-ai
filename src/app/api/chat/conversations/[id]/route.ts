import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isMessagingEngineEnabled } from "@/lib/config/feature-flags";
import {
  assertChatParticipants,
  loadConversationTimeline,
  getConversationSafetySettings,
  listReactionsForMessages,
} from "@/domains/chat";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { handleApiRoute } from "@/lib/observability/api-route";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/chat/conversations/[id] — conversation detail + timeline + safety.
 */
export async function GET(request: Request, { params }: RouteParams) {
  return handleApiRoute("chat_conversations_id", async () => {
    if (!isMessagingEngineEnabled()) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
    }

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }

    const rate = checkRateLimit(rateLimitKey("chat_api_detail", authUser.id), {
      max: 90,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { id } = await params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const gate = await assertChatParticipants({
      conversationId: id,
      userId: authUser.id,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 });
    }

    const supabase = await createClient();
    // Sprint 5 columns — cast until Database types regenerate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: messages } = await (supabase as any)
      .from("messages")
      .select(
        "id, body_text, sender_id, created_at, is_system, event_type, delivery_status, message_type, reply_to_message_id, edited_at, deleted_at",
      )
      .eq("conversation_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = ((messages ?? []) as Array<Record<string, unknown>>).reverse();
    const messageIds = rows.map((m) => m.id as string);
    const [timeline, safety, reactions] = await Promise.all([
      loadConversationTimeline({
        conversationId: id,
        serviceRequestId: gate.serviceRequestId,
      }),
      getConversationSafetySettings({
        conversationId: id,
        userId: authUser.id,
        peerUserId:
          authUser.id === gate.customerId
            ? gate.providerOwnerId
            : gate.customerId,
      }),
      listReactionsForMessages({ messageIds, userId: authUser.id }),
    ]);

    return NextResponse.json({
      conversation: {
        id,
        serviceRequestId: gate.serviceRequestId,
        providerId: gate.providerId,
        customerId: gate.customerId,
      },
      messages: rows.map((m) => ({
        id: m.id,
        bodyText: m.body_text,
        senderId: m.sender_id,
        createdAt: m.created_at,
        isSystem: Boolean(m.is_system),
        eventType: m.event_type ?? null,
        deliveryStatus: m.delivery_status ?? null,
        messageType: m.message_type ?? "text",
        replyToMessageId: m.reply_to_message_id ?? null,
        editedAt: m.edited_at ?? null,
        reactions: reactions.get(m.id as string) ?? [],
      })),
      timeline,
      safety,
    });
  });
}
