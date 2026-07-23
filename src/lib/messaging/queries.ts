import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import type { BusinessConversation, ConversationMessage } from "@/lib/business/conversations";
import { resolveLatestMessageAt } from "@/lib/messaging/format-conversation-time";

type ConversationRow = {
  id: string;
  provider_id: string;
  customer_id: string;
  service_request_id: string | null;
  last_message_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body_text: string;
  created_at: string;
  is_system?: boolean;
  event_type?: string | null;
  delivery_status?: string | null;
  message_type?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
};

export async function loadConversationsForCustomer(
  userId: string,
): Promise<BusinessConversation[]> {
  const supabase = await createClient();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, provider_id, customer_id, service_request_id, last_message_at, created_at")
    .eq("customer_id", userId)
    .order("last_message_at", { ascending: false });

  if (error || !conversations?.length) return [];
  return buildConversationList(conversations as ConversationRow[], userId, "customer");
}

export async function loadConversationsForBusiness(
  userId: string,
): Promise<BusinessConversation[]> {
  const provider = await getOwnedProvider(userId);
  if (!provider) return [];

  const supabase = await createClient();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, provider_id, customer_id, service_request_id, last_message_at, created_at")
    .eq("provider_id", provider.id)
    .order("last_message_at", { ascending: false });

  if (error || !conversations?.length) return [];
  return buildConversationList(conversations as ConversationRow[], userId, "business");
}

async function buildConversationList(
  conversations: ConversationRow[],
  viewerId: string,
  viewer: "customer" | "business",
): Promise<BusinessConversation[]> {
  const supabase = await createClient();
  const ids = conversations.map((c) => c.id);

  let messages: MessageRow[] | null = null;
  {
    const primary = await supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, body_text, created_at, is_system, event_type, delivery_status, message_type, location_lat, location_lng, location_label",
      )
      .in("conversation_id", ids)
      .order("created_at", { ascending: true });

    if (primary.error) {
      const fallback = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body_text, created_at, is_system, event_type")
        .in("conversation_id", ids)
        .order("created_at", { ascending: true });
      messages = (fallback.data ?? null) as unknown as MessageRow[] | null;
    } else {
      messages = (primary.data ?? null) as unknown as MessageRow[] | null;
    }
  }

  const messagesByConv = new Map<string, MessageRow[]>();
  for (const msg of messages ?? []) {
    const list = messagesByConv.get(msg.conversation_id) ?? [];
    list.push(msg);
    messagesByConv.set(msg.conversation_id, list);
  }

  const customerIds = [...new Set(conversations.map((c) => c.customer_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", customerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.display_name as string]),
  );

  const providerIds = [...new Set(conversations.map((c) => c.provider_id))];
  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, owner_id")
    .in("id", providerIds);

  const providerMap = new Map(
    (providers ?? []).map((p) => [
      p.id,
      {
        name:
          typeof p.name === "object" && p.name !== null
            ? ((p.name as { en?: string }).en ?? (p.name as { ar?: string }).ar ?? "Business")
            : "Business",
        ownerId: p.owner_id as string,
      },
    ]),
  );

  return conversations.map((conv) => {
    const rawMessages = messagesByConv.get(conv.id) ?? [];
    const mappedMessages: ConversationMessage[] = rawMessages.map((m) => {
      const from = m.is_system
        ? "dalily"
        : m.sender_id === viewerId
          ? viewer === "customer"
            ? "customer"
            : "business"
          : viewer === "customer"
            ? "business"
            : "customer";
      const ownMessage =
        !m.is_system &&
        ((viewer === "customer" && from === "customer") ||
          (viewer === "business" && from === "business"));
      return {
        id: m.id,
        bodyText: m.body_text,
        bodyKey: "",
        createdAt: m.created_at,
        from: from as ConversationMessage["from"],
        // Own messages start read; counterpart/system need read-cookie threshold
        read: ownMessage,
        isSystem: Boolean(m.is_system),
        eventType: m.event_type ?? null,
        deliveryStatus: (m.delivery_status as ConversationMessage["deliveryStatus"]) ?? "sent",
        messageType: (m.message_type as ConversationMessage["messageType"]) ?? "text",
        locationLat: m.location_lat ?? null,
        locationLng: m.location_lng ?? null,
        locationLabel: m.location_label ?? null,
      };
    });

    const last = mappedMessages[mappedMessages.length - 1];
    const providerInfo = providerMap.get(conv.provider_id);
    const name =
      viewer === "customer"
        ? (providerInfo?.name ?? "Business")
        : (profileMap.get(conv.customer_id) ?? "Customer");
    const unreadCount = mappedMessages.filter((m) => !m.read).length;
    // Prefer the newest message row; never fall back to a bogus/epoch last_message_at.
    const updatedAt = resolveLatestMessageAt(mappedMessages);

    return {
      id: conv.id,
      kind: "customer" as const,
      name,
      avatarTone: "customer" as const,
      previewText: last?.bodyText ?? "",
      updatedAt,
      unreadCount,
      state: unreadCount > 0 ? ("unread" as const) : ("read" as const),
      messages: mappedMessages,
      serviceRequestId: conv.service_request_id,
      peerUserId: viewer === "customer" ? (providerInfo?.ownerId ?? null) : conv.customer_id,
    };
  });
}

export async function loadConversationById(
  conversationId: string,
  userId: string,
  viewer: "customer" | "business",
): Promise<BusinessConversation | null> {
  const list =
    viewer === "customer"
      ? await loadConversationsForCustomer(userId)
      : await loadConversationsForBusiness(userId);

  return list.find((c) => c.id === conversationId) ?? null;
}
