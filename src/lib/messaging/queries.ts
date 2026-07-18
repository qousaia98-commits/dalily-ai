import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/queries";
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

  const { data: messages } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body_text, created_at, is_system, event_type")
    .in("conversation_id", ids)
    .order("created_at", { ascending: true });

  const messagesByConv = new Map<string, MessageRow[]>();
  for (const msg of (messages ?? []) as MessageRow[]) {
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
    .select("id, name")
    .in("id", providerIds);

  const providerMap = new Map(
    (providers ?? []).map((p) => [
      p.id,
      typeof p.name === "object" && p.name !== null
        ? ((p.name as { en?: string }).en ?? (p.name as { ar?: string }).ar ?? "Business")
        : "Business",
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
      };
    });

    const last = mappedMessages[mappedMessages.length - 1];
    const name =
      viewer === "customer"
        ? (providerMap.get(conv.provider_id) ?? "Business")
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
