import { createClient } from "@/lib/supabase/server";
import type { ChatAttachment, ChatDeliveryStatus, ChatMessage, ChatMessageType } from "@/lib/chat/types";
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/chat/attachment-service";

const PAGE_SIZE = 50;

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body_text: string;
  created_at: string;
  is_system?: boolean;
  event_type?: string | null;
  message_type?: string | null;
  delivery_status?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  client_id?: string | null;
  metadata?: Record<string, unknown> | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
  reply_to_message_id?: string | null;
  is_pinned?: boolean | null;
  pinned_at?: string | null;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  conversation_id: string;
  path: string;
  bucket: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: string;
  width?: number | null;
  height?: number | null;
};

function mapMessage(
  row: MessageRow,
  attachments: ChatAttachment[],
  replyPreview?: string | null,
): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    bodyText: row.body_text ?? "",
    messageType: (row.message_type as ChatMessageType) ?? (row.is_system ? "system" : "text"),
    deliveryStatus: (row.delivery_status as ChatDeliveryStatus) ?? "sent",
    isSystem: Boolean(row.is_system),
    eventType: row.event_type ?? null,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
    locationLat: row.location_lat ?? null,
    locationLng: row.location_lng ?? null,
    locationLabel: row.location_label ?? null,
    clientId: row.client_id ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    attachments,
    replyToMessageId: row.reply_to_message_id ?? null,
    replyPreview: replyPreview ?? null,
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at ?? null,
  };
}

export async function listMessages(input: {
  conversationId: string;
  before?: string | null;
  limit?: number;
}): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const limit = input.limit ?? PAGE_SIZE;

  let query = (supabase as unknown as {
    from: (t: string) => ReturnType<typeof supabase.from>;
  })
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body_text, created_at, is_system, event_type, message_type, delivery_status, edited_at, deleted_at, client_id, metadata, location_lat, location_lng, location_label, reply_to_message_id, is_pinned, pinned_at",
    )
    .eq("conversation_id", input.conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.before) {
    query = query.lt("created_at", input.before);
  }

  let { data, error } = await query;
  if (error) {
    let fallback = supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, body_text, created_at, is_system, event_type, message_type, delivery_status, edited_at, deleted_at, client_id, metadata, location_lat, location_lng, location_label",
      )
      .eq("conversation_id", input.conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (input.before) {
      fallback = fallback.lt("created_at", input.before);
    }
    const fb = await fallback;
    data = fb.data as typeof data;
    error = fb.error;
  }
  if (error || !data) return [];

  const rows = data as unknown as MessageRow[];
  const messageIds = rows.map((r) => r.id);

  let attachmentRows: AttachmentRow[] = [];
  if (messageIds.length) {
    // Sprint 36 table — cast until Database types regenerate.
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => ReturnType<typeof supabase.from>;
      }
    )
      .from("message_attachments")
      .select(
        "id, message_id, conversation_id, path, bucket, file_name, mime_type, size_bytes, kind, width, height",
      )
      .in("message_id", messageIds)
      .is("deleted_at", null);
    attachmentRows = (data ?? []) as unknown as AttachmentRow[];
  }

  const byMessage = new Map<string, ChatAttachment[]>();
  for (const att of attachmentRows) {
    const list = byMessage.get(att.message_id) ?? [];
    let signedUrl: string | null = null;
    try {
      const { data: signed } = await supabase.storage
        .from(att.bucket || CHAT_ATTACHMENTS_BUCKET)
        .createSignedUrl(att.path, 3600);
      signedUrl = signed?.signedUrl ?? null;
    } catch {
      signedUrl = null;
    }
    list.push({
      id: att.id,
      messageId: att.message_id,
      conversationId: att.conversation_id,
      fileName: att.file_name,
      mimeType: att.mime_type,
      sizeBytes: Number(att.size_bytes),
      kind: att.kind as ChatAttachment["kind"],
      path: att.path,
      bucket: att.bucket,
      width: att.width,
      height: att.height,
      signedUrl,
    });
    byMessage.set(att.message_id, list);
  }

  return rows
    .map((row) => mapMessage(row, byMessage.get(row.id) ?? []))
    .reverse();
}

export async function searchMessages(input: {
  conversationId?: string | null;
  userId: string;
  query: string;
  senderId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}): Promise<ChatMessage[]> {
  const q = input.query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  try {
    // Prefer participant-scoped RPC (Sprint 5)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("search_chat_messages", {
      p_user_id: input.userId,
      p_query: q,
      p_conversation_id: input.conversationId ?? null,
      p_sender_id: input.senderId ?? null,
      p_from: input.from ?? null,
      p_to: input.to ?? null,
      p_limit: input.limit ?? 40,
    });
    if (!error && data) {
      return (data as MessageRow[]).map((row) => mapMessage(row, []));
    }
  } catch {
    /* fall through */
  }

  let query = supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body_text, created_at, is_system, event_type, message_type, delivery_status, edited_at, deleted_at, client_id, metadata, location_lat, location_lng, location_label, reply_to_message_id, is_pinned, pinned_at",
    )
    .is("deleted_at", null)
    .ilike("body_text", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 40);

  if (input.conversationId) {
    query = query.eq("conversation_id", input.conversationId);
  }
  if (input.senderId) query = query.eq("sender_id", input.senderId);
  if (input.from) query = query.gte("created_at", input.from);
  if (input.to) query = query.lte("created_at", input.to);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as MessageRow[]).map((row) => mapMessage(row, []));
}

export async function insertTextMessage(input: {
  conversationId: string;
  senderId: string;
  bodyText: string;
  clientId?: string | null;
  messageType?: ChatMessageType;
  locationLat?: number | null;
  locationLng?: number | null;
  locationLabel?: string | null;
  replyToMessageId?: string | null;
}): Promise<{ messageId: string } | { error: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body_text: input.bodyText,
      is_system: false,
      message_type: input.messageType ?? "text",
      delivery_status: "sent",
      client_id: input.clientId ?? null,
      location_lat: input.locationLat ?? null,
      location_lng: input.locationLng ?? null,
      location_label: input.locationLabel ?? null,
      reply_to_message_id: input.replyToMessageId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "send_failed" };
  return { messageId: data.id as string };
}

export async function editMessage(input: {
  messageId: string;
  senderId: string;
  bodyText: string;
}): Promise<{ success: boolean }> {
  const text = input.bodyText.trim();
  if (!text) return { success: false };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("messages")
    .update({
      body_text: text,
      edited_at: new Date().toISOString(),
    })
    .eq("id", input.messageId)
    .eq("sender_id", input.senderId)
    .is("deleted_at", null);
  return { success: !error };
}

export async function setMessagePinned(input: {
  messageId: string;
  conversationId: string;
  userId: string;
  pinned: boolean;
}): Promise<{ success: boolean }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("messages")
    .update({
      is_pinned: input.pinned,
      pinned_at: input.pinned ? new Date().toISOString() : null,
      pinned_by: input.pinned ? input.userId : null,
    })
    .eq("id", input.messageId)
    .eq("conversation_id", input.conversationId)
    .is("deleted_at", null);
  return { success: !error };
}

export async function softDeleteMessage(input: {
  messageId: string;
  senderId: string;
}): Promise<{ success: boolean }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), body_text: "" })
    .eq("id", input.messageId)
    .eq("sender_id", input.senderId);

  return { success: !error };
}
