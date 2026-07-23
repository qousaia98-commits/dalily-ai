"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { trackChatAnalytics } from "@/lib/chat/analytics";
import { setConversationFlags, type ConversationViewer } from "@/lib/chat/conversation-service";
import { insertTextMessage, searchMessages, softDeleteMessage } from "@/lib/chat/message-service";
import {
  insertMessageAttachment,
  isAllowedChatAttachment,
  uploadChatAttachment,
} from "@/lib/chat/attachment-service";
import { markConversationReadServer, setTypingStatus } from "@/lib/chat/notification-service";
import { upsertPresence } from "@/lib/chat/presence-service";
import { sendMessageSchema } from "@/lib/validations/service-request";

function revalidateConversation(conversationId: string) {
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/business/messages/${conversationId}`);
  revalidatePath("/messages");
  revalidatePath("/business/messages");
  revalidatePath("/business", "layout");
}

async function assertParticipant(conversationId: string, userId: string) {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, provider_id, customer_id, service_request_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { ok: false as const, error: "not_found" as const };

  const { data: providerRow } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();

  const isParticipant = userId === conv.customer_id || userId === providerRow?.owner_id;
  if (!isParticipant) return { ok: false as const, error: "forbidden" as const };

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
      return { ok: false as const, error: "chat_locked" as const, conv, providerRow };
    }
  }

  return { ok: true as const, conv, providerRow };
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

  let messageType: "text" | "image" | "document" | "location" = "text";
  if (hasLocation) messageType = "location";
  if (hasFile && file instanceof File) {
    if (!isAllowedChatAttachment(file.type)) return { success: false, error: "invalid_file_type" };
    messageType = file.type.startsWith("image/") ? "image" : "document";
  }

  const body =
    bodyText ||
    (hasLocation ? locationLabel || "Shared a location" : "") ||
    (hasFile && file instanceof File ? file.name : "") ||
    " ";

  const inserted = await insertTextMessage({
    conversationId,
    senderId: authUser.id,
    bodyText: body,
    clientId,
    messageType,
    locationLat: hasLocation ? Number(latRaw) : null,
    locationLng: hasLocation ? Number(lngRaw) : null,
    locationLabel,
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
    metadata: { messageType },
  });

  const notifyUserId =
    authUser.id === gate.conv.customer_id
      ? gate.providerRow?.owner_id
      : gate.conv.customer_id;

  if (notifyUserId) {
    const supabase = await createClient();
    await supabase.rpc("notify_marketplace_user", {
      p_user_id: notifyUserId,
      p_type: "new_message",
      p_title_key: "notifications.newMessage.title",
      p_body_key: hasFile
        ? "notifications.newMessage.attachmentBody"
        : "notifications.newMessage.body",
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
  revalidateConversation(conversationId);
  return { success: true };
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
}): Promise<{ success: boolean; results: Awaited<ReturnType<typeof searchMessages>> }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, results: [] };
  const results = await searchMessages({
    query: input.query,
    conversationId: input.conversationId,
    userId: authUser.id,
  });
  return { success: true, results };
}

export async function softDeleteChatMessageAction(
  messageId: string,
): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const result = await softDeleteMessage({ messageId, senderId: authUser.id });
  return result;
}

export async function setPresenceAction(
  status: "online" | "offline",
): Promise<{ success: boolean }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  await upsertPresence(authUser.id, status);
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
