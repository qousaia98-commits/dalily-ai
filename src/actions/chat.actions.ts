"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  trackChatAnalytics,
  setConversationFlags,
  type ConversationViewer,
  insertTextMessage,
  searchMessages,
  softDeleteMessage,
  editMessage,
  setMessagePinned,
  insertMessageAttachment,
  isAllowedChatAttachment,
  uploadChatAttachment,
  markConversationReadServer,
  setTypingStatus,
  upsertPresence,
  markAllConversationsRead,
  assertChatParticipants,
} from "@/domains/chat";
import { sendMessageSchema } from "@/lib/validations/service-request";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isRealtimeEngineEnabled, isChatEngineEnabled, isEnterpriseCommunicationEnabled } from "@/lib/config/feature-flags";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import {
  scrubContactLeaks,
  isMessagingBlocked,
  getConversationSafetySettings,
} from "@/domains/chat/communication";

function revalidateConversation(conversationId: string) {
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/business/messages/${conversationId}`);
  revalidatePath("/messages");
  revalidatePath("/business/messages");
  revalidatePath("/business", "layout");
}

async function assertParticipant(conversationId: string, userId: string) {
  if (isChatEngineEnabled()) {
    const gate = await assertChatParticipants({ conversationId, userId });
    if (!gate.ok) {
      return {
        ok: false as const,
        error: gate.error,
        conv: null,
        providerRow: null,
      };
    }
    return {
      ok: true as const,
      conv: {
        id: conversationId,
        provider_id: gate.providerId,
        customer_id: gate.customerId,
        service_request_id: gate.serviceRequestId,
        chat_scope: gate.chatScope,
        admin_user_id: gate.adminUserId,
      },
      providerRow: { owner_id: gate.providerOwnerId },
    };
  }

  const supabase = await createClient();
  // Sprint 5 columns — cast until Database types regenerate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (supabase as any)
    .from("conversations")
    .select("id, provider_id, customer_id, service_request_id, chat_scope, admin_user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { ok: false as const, error: "not_found" as const };

  const { data: providerRow } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();

  const isParticipant =
    userId === conv.customer_id ||
    userId === providerRow?.owner_id ||
    userId === conv.admin_user_id;
  if (!isParticipant) return { ok: false as const, error: "forbidden" as const };

  const scope = (conv.chat_scope as string | null) ?? null;
  const nonRequestScope =
    scope != null &&
    scope !== "request" &&
    ["project", "package", "emergency", "admin", "support"].includes(scope);

  if (conv.service_request_id && !nonRequestScope) {
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
      return {
        ok: false as const,
        error: "chat_locked" as const,
        conv: conv as {
          id: string;
          provider_id: string;
          customer_id: string;
          service_request_id: string | null;
          chat_scope: string | null;
          admin_user_id: string | null;
        },
        providerRow,
      };
    }
  }

  return {
    ok: true as const,
    conv: conv as {
      id: string;
      provider_id: string;
      customer_id: string;
      service_request_id: string | null;
      chat_scope: string | null;
      admin_user_id: string | null;
    },
    providerRow,
  };
}

export async function sendChatMessageAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
}> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const conversationId = String(formData.get("conversationId") ?? "");
  const bodyText = String(formData.get("bodyText") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "") || null;
  const replyToMessageId = String(formData.get("replyToMessageId") ?? "") || null;
  const latRaw = formData.get("locationLat");
  const lngRaw = formData.get("locationLng");
  const locationLabel = String(formData.get("locationLabel") ?? "") || null;
  const file = formData.get("file");

  const hasFile = file instanceof File && file.size > 0;
  const hasLocation =
    latRaw != null &&
    lngRaw != null &&
    Number.isFinite(Number(latRaw)) &&
    Number.isFinite(Number(lngRaw));

  if (!hasFile && !hasLocation) {
    const parsed = sendMessageSchema.safeParse({ conversationId, bodyText });
    if (!parsed.success) return { success: false, error: "validation_error" };
  } else if (!conversationId) {
    return { success: false, error: "validation_error" };
  }

  const gate = await assertParticipant(conversationId, authUser.id);
  if (!gate.ok) return { success: false, error: gate.error };

  const rate = checkRateLimit(rateLimitKey("chat_send", authUser.id), {
    max: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) return { success: false, error: "rate_limited" };

  if (isEnterpriseCommunicationEnabled() && gate.conv) {
    const peerId =
      authUser.id === gate.conv.customer_id
        ? (gate.providerRow?.owner_id as string | undefined) ?? null
        : gate.conv.customer_id;
    if (peerId) {
      const blocked = await isMessagingBlocked({
        senderId: authUser.id,
        recipientId: peerId,
      });
      if (blocked) return { success: false, error: "blocked" };
    }
    const safety = await getConversationSafetySettings({
      conversationId,
      userId: authUser.id,
      peerUserId: peerId,
    });
    if (safety.moderationStatus === "suspended") {
      return { success: false, error: "conversation_suspended" };
    }
  }

  let messageType: "text" | "image" | "document" | "location" = "text";
  if (hasLocation) messageType = "location";
  if (hasFile && file instanceof File) {
    if (!isAllowedChatAttachment(file.type)) return { success: false, error: "invalid_file_type" };
    messageType = file.type.startsWith("image/") ? "image" : "document";
  }

  let body =
    bodyText ||
    (hasLocation ? locationLabel || "Shared a location" : "") ||
    (hasFile && file instanceof File ? file.name : "") ||
    " ";

  if (isEnterpriseCommunicationEnabled() && gate.conv.service_request_id) {
    const { canAccessFullChat } = await import("@/domains/chat");
    const supabase = await createClient();
    const { data: req } = await supabase
      .from("service_requests")
      .select("status, lifecycle_version")
      .eq("id", gate.conv.service_request_id)
      .maybeSingle();
    const open = await canAccessFullChat({
      serviceRequestId: gate.conv.service_request_id,
      status: (req?.status as import("@/lib/service-requests/status-machine").ServiceRequestStatus | null) ?? null,
      lifecycleVersion: (req?.lifecycle_version as number | null) ?? 2,
    }).catch(() => false);
    if (!open) {
      body = scrubContactLeaks(body).text;
      if (hasLocation) {
        return { success: false, error: "chat_locked" };
      }
    }
  }

  const inserted = await insertTextMessage({
    conversationId,
    senderId: authUser.id,
    bodyText: body,
    clientId,
    messageType,
    locationLat: hasLocation ? Number(latRaw) : null,
    locationLng: hasLocation ? Number(lngRaw) : null,
    locationLabel,
    replyToMessageId,
  });

  if ("error" in inserted) return { success: false, error: inserted.error };

  if (hasFile && file instanceof File) {
    const uploaded = await uploadChatAttachment({
      userId: authUser.id,
      conversationId,
      file,
    });
    if (!uploaded.success) return { success: false, error: uploaded.error };
    await insertMessageAttachment({
      messageId: inserted.messageId,
      conversationId,
      uploaderId: authUser.id,
      path: uploaded.path,
      bucket: uploaded.bucket,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      kind: uploaded.kind,
    });
    await trackChatAnalytics({
      eventType: "attachment_sent",
      conversationId,
      actorId: authUser.id,
      metadata: { kind: uploaded.kind },
    });
  }

  await trackChatAnalytics({
    eventType: "message_sent",
    conversationId,
    actorId: authUser.id,
    metadata: { messageType, reply: Boolean(replyToMessageId) },
  });

  if (isRealtimeEngineEnabled()) {
    void emitAiLearningEvent({
      eventType: replyToMessageId ? "chat_reply_sent" : "chat_message_sent",
      customerId:
        authUser.id === gate.conv.customer_id ? authUser.id : gate.conv.customer_id,
      providerId: gate.conv.provider_id,
      serviceRequestId: gate.conv.service_request_id,
      metadata: {
        conversationId,
        messageId: inserted.messageId,
        messageType,
      },
    });
  }

  const notifyUserId =
    authUser.id === gate.conv.customer_id
      ? gate.providerRow?.owner_id
      : gate.conv.customer_id;

  if (notifyUserId) {
    const supabase = await createClient();
    const isEmergency =
      "chat_scope" in gate.conv && gate.conv.chat_scope === "emergency";
    const notifType = isEmergency
      ? "chat_emergency"
      : replyToMessageId
        ? "chat_reply"
        : "new_message";
    const titleKey = isEmergency
      ? "notifications.chatEmergency.title"
      : replyToMessageId
        ? "notifications.chatReply.title"
        : "notifications.newMessage.title";
    const bodyKey = isEmergency
      ? "notifications.chatEmergency.body"
      : hasFile
        ? "notifications.newMessage.attachmentBody"
        : replyToMessageId
          ? "notifications.chatReply.body"
          : "notifications.newMessage.body";
    await supabase.rpc("notify_marketplace_user", {
      p_user_id: notifyUserId,
      p_type: notifType,
      p_title_key: titleKey,
      p_body_key: bodyKey,
      p_body_params: {},
      p_href:
        authUser.id === gate.conv.customer_id
          ? `/business/messages/${conversationId}`
          : `/messages/${conversationId}`,
      p_request_id: gate.conv.service_request_id,
      p_conversation_id: conversationId,
    });
  }

  revalidateConversation(conversationId);
  return { success: true, messageId: inserted.messageId };
}

export async function markChatReadAction(
  conversationId: string,
): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser || !conversationId) return { success: false };

  await markConversationReadServer(conversationId, authUser.id);
  await trackChatAnalytics({
    eventType: "message_read",
    conversationId,
    actorId: authUser.id,
  });
  if (isRealtimeEngineEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_read",
      customerId: authUser.id,
      metadata: { conversationId },
    });
  }
  revalidateConversation(conversationId);
  return { success: true };
}

export async function markAllChatsReadAction(): Promise<{
  success: boolean;
  updated: number;
}> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, updated: 0 };
  const updated = await markAllConversationsRead(authUser.id);
  revalidatePath("/messages");
  revalidatePath("/business/messages");
  return { success: true, updated };
}

export async function setTypingAction(
  conversationId: string,
  typing: boolean,
): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser || !conversationId) return { success: false };
  await setTypingStatus({ conversationId, userId: authUser.id, typing });
  return { success: true };
}

export async function updateConversationFlagsAction(input: {
  conversationId: string;
  viewer: ConversationViewer;
  pinned?: boolean;
  archived?: boolean;
  status?: "open" | "closed" | "archived";
}): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false, error: gate.error };

  const result = await setConversationFlags(input);
  if (result.success && input.status === "closed") {
    await trackChatAnalytics({
      eventType: "conversation_closed",
      conversationId: input.conversationId,
      actorId: authUser.id,
    });
  }
  revalidateConversation(input.conversationId);
  return result;
}

export async function searchChatMessagesAction(input: {
  query: string;
  conversationId?: string | null;
  senderId?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<{ success: boolean; results: Awaited<ReturnType<typeof searchMessages>> }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, results: [] };
  const results = await searchMessages({
    query: input.query,
    conversationId: input.conversationId,
    senderId: input.senderId,
    from: input.from,
    to: input.to,
    userId: authUser.id,
  });
  if (isRealtimeEngineEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_search",
      customerId: authUser.id,
      metadata: { qLen: input.query.length, hits: results.length },
    });
  }
  return { success: true, results };
}

export async function softDeleteChatMessageAction(
  messageId: string,
): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const result = await softDeleteMessage({ messageId, senderId: authUser.id });
  if (result.success && isRealtimeEngineEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_message_deleted",
      customerId: authUser.id,
      metadata: { messageId },
    });
  }
  return result;
}

export async function editChatMessageAction(input: {
  messageId: string;
  bodyText: string;
  conversationId: string;
}): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false };
  const result = await editMessage({
    messageId: input.messageId,
    senderId: authUser.id,
    bodyText: input.bodyText,
  });
  if (result.success) {
    if (isRealtimeEngineEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_message_edited",
        customerId: authUser.id,
        metadata: { messageId: input.messageId },
      });
    }
    revalidateConversation(input.conversationId);
  }
  return result;
}

export async function pinChatMessageAction(input: {
  messageId: string;
  conversationId: string;
  pinned: boolean;
}): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false };
  const result = await setMessagePinned({
    messageId: input.messageId,
    conversationId: input.conversationId,
    userId: authUser.id,
    pinned: input.pinned,
  });
  if (result.success) {
    if (isRealtimeEngineEnabled()) {
      void emitAiLearningEvent({
        eventType: input.pinned ? "chat_message_pinned" : "chat_message_unpinned",
        customerId: authUser.id,
        metadata: { messageId: input.messageId },
      });
      // Notify peer about pin
      const notifyUserId =
        authUser.id === gate.conv.customer_id
          ? gate.providerRow?.owner_id
          : gate.conv.customer_id;
      if (notifyUserId && input.pinned) {
        const supabase = await createClient();
        await supabase.rpc("notify_marketplace_user", {
          p_user_id: notifyUserId,
          p_type: "chat_pinned",
          p_title_key: "notifications.chatPinned.title",
          p_body_key: "notifications.chatPinned.body",
          p_body_params: {},
          p_href:
            authUser.id === gate.conv.customer_id
              ? `/business/messages/${input.conversationId}`
              : `/messages/${input.conversationId}`,
          p_request_id: gate.conv.service_request_id,
          p_conversation_id: input.conversationId,
        });
      }
    }
    revalidateConversation(input.conversationId);
  }
  return result;
}

export async function setPresenceAction(
  status: "online" | "offline",
): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  await upsertPresence(authUser.id, status);
  if (isRealtimeEngineEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_presence",
      customerId: authUser.id,
      metadata: { status },
    });
  }
  return { success: true };
}

/** Keep legacy text send working through the new chat module + analytics. */
export async function sendLegacyTextMessageAction(
  conversationId: string,
  bodyText: string,
): Promise<{ success: boolean; error?: string }> {
  const fd = new FormData();
  fd.set("conversationId", conversationId);
  fd.set("bodyText", bodyText);
  const result = await sendChatMessageAction(fd);
  return { success: result.success, error: result.error };
}
