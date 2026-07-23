import { createClient } from "@/lib/supabase/server";
import type { ChatConversation, ChatConversationStatus } from "@/lib/chat/types";

export type ConversationViewer = "customer" | "business";

type ConvRow = {
  id: string;
  provider_id: string;
  customer_id: string;
  service_request_id: string | null;
  last_message_at: string | null;
  status: ChatConversationStatus | null;
  pinned_by_customer: boolean | null;
  pinned_by_provider: boolean | null;
  archived_by_customer: boolean | null;
  archived_by_provider: boolean | null;
  deleted_at: string | null;
};

/**
 * Ensures one conversation per service request — reuses existing row.
 */
export async function getOrCreateConversationForRequest(input: {
  serviceRequestId: string;
  providerId: string;
  customerId: string;
}): Promise<{ conversationId: string; created: boolean } | null> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("service_request_id", input.serviceRequestId)
    .maybeSingle();

  if (existing?.id) {
    return { conversationId: existing.id, created: false };
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      provider_id: input.providerId,
      customer_id: input.customerId,
      service_request_id: input.serviceRequestId,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) return null;
  return { conversationId: created.id, created: true };
}

export async function listConversationsForViewer(input: {
  viewer: ConversationViewer;
  userId: string;
  providerId?: string | null;
  includeArchived?: boolean;
}): Promise<ChatConversation[]> {
  const supabase = await createClient();
  let query = supabase
    .from("conversations")
    .select(
      "id, provider_id, customer_id, service_request_id, last_message_at, status, pinned_by_customer, pinned_by_provider, archived_by_customer, archived_by_provider, deleted_at",
    )
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false });

  if (input.viewer === "customer") {
    query = query.eq("customer_id", input.userId);
    if (!input.includeArchived) query = query.eq("archived_by_customer", false);
  } else {
    if (!input.providerId) return [];
    query = query.eq("provider_id", input.providerId);
    if (!input.includeArchived) query = query.eq("archived_by_provider", false);
  }

  const { data: rows, error } = await query;
  if (error || !rows?.length) return [];

  const conversations = rows as unknown as ConvRow[];
  const ids = conversations.map((c) => c.id);

  const { data: messages } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body_text, created_at, is_system")
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const latestByConv = new Map<string, { body: string; senderId: string; createdAt: string }>();
  const unreadByConv = new Map<string, number>();

  for (const msg of messages ?? []) {
    const row = msg as {
      id: string;
      conversation_id: string;
      sender_id: string;
      body_text: string;
      created_at: string;
      is_system?: boolean;
    };
    if (!latestByConv.has(row.conversation_id)) {
      latestByConv.set(row.conversation_id, {
        body: row.body_text,
        senderId: row.sender_id,
        createdAt: row.created_at,
      });
    }
    if (!row.is_system && row.sender_id !== input.userId) {
      unreadByConv.set(row.conversation_id, (unreadByConv.get(row.conversation_id) ?? 0) + 1);
    }
  }

  // Prefer participant last_read_at when available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parts } = await (supabase as any)
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", input.userId)
    .in("conversation_id", ids);

  const readMap = new Map<string, string>(
    ((parts ?? []) as Array<{ conversation_id: string; last_read_at: string | null }>).map(
      (p) => [p.conversation_id, p.last_read_at ?? ""],
    ),
  );

  for (const [convId] of unreadByConv) {
    const threshold = readMap.get(convId);
    if (!threshold) continue;
    const thresholdMs = Date.parse(threshold);
    if (!Number.isFinite(thresholdMs)) continue;
    let unread = 0;
    for (const msg of messages ?? []) {
      const row = msg as {
        conversation_id: string;
        sender_id: string;
        created_at: string;
        is_system?: boolean;
      };
      if (row.conversation_id !== convId) continue;
      if (row.is_system || row.sender_id === input.userId) continue;
      if (Date.parse(row.created_at) > thresholdMs) unread += 1;
    }
    unreadByConv.set(convId, unread);
  }

  const customerIds = [...new Set(conversations.map((c) => c.customer_id))];
  const providerIds = [...new Set(conversations.map((c) => c.provider_id))];

  const [{ data: profiles }, { data: providers }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name").in("user_id", customerIds),
    supabase.from("providers").select("id, name, owner_id").in("id", providerIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name as string]));
  const providerMap = new Map(
    (providers ?? []).map((p) => {
      const name =
        typeof p.name === "object" && p.name !== null
          ? ((p.name as { en?: string }).en ?? (p.name as { ar?: string }).ar ?? "Business")
          : "Business";
      return [p.id, { name, ownerId: p.owner_id as string }];
    }),
  );

  const result = conversations.map((conv) => {
    const pinned =
      input.viewer === "customer"
        ? Boolean(conv.pinned_by_customer)
        : Boolean(conv.pinned_by_provider);
    const archived =
      input.viewer === "customer"
        ? Boolean(conv.archived_by_customer)
        : Boolean(conv.archived_by_provider);
    const peer =
      input.viewer === "customer"
        ? {
            name: providerMap.get(conv.provider_id)?.name ?? "Business",
            userId: providerMap.get(conv.provider_id)?.ownerId ?? "",
          }
        : {
            name: profileMap.get(conv.customer_id) ?? "Customer",
            userId: conv.customer_id,
          };
    const latest = latestByConv.get(conv.id);

    return {
      id: conv.id,
      providerId: conv.provider_id,
      customerId: conv.customer_id,
      serviceRequestId: conv.service_request_id,
      status: (conv.status ?? "open") as ChatConversationStatus,
      lastMessageAt: latest?.createdAt ?? conv.last_message_at,
      pinned,
      archived,
      unreadCount: unreadByConv.get(conv.id) ?? 0,
      peerName: peer.name,
      peerUserId: peer.userId,
      previewText: latest?.body ?? "",
    } satisfies ChatConversation;
  });

  return result.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aMs = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bMs = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
  });
}

export async function setConversationFlags(input: {
  conversationId: string;
  viewer: ConversationViewer;
  pinned?: boolean;
  archived?: boolean;
  status?: ChatConversationStatus;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};

  if (input.viewer === "customer") {
    if (input.pinned != null) patch.pinned_by_customer = input.pinned;
    if (input.archived != null) patch.archived_by_customer = input.archived;
  } else {
    if (input.pinned != null) patch.pinned_by_provider = input.pinned;
    if (input.archived != null) patch.archived_by_provider = input.archived;
  }
  if (input.status) {
    patch.status = input.status;
    if (input.status === "closed") patch.closed_at = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversations")
    .update(patch)
    .eq("id", input.conversationId);

  if (error) return { success: false, error: "update_failed" };
  return { success: true };
}
