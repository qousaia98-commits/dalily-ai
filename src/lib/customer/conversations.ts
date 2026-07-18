import type { MsgReadMap } from "@/lib/business/message-read-state";
import {
  applyConversationReadState,
  countUnreadConversations,
  filterConversations,
  findConversation,
  type BusinessConversation,
  type ConversationMessage,
} from "@/lib/business/conversations";

export type CustomerConversation = BusinessConversation;

export { countUnreadConversations, filterConversations, findConversation };

/**
 * Customer inbox — business chats appear here when realtime messaging launches.
 */
export function buildCustomerConversations(input: {
  readMap?: MsgReadMap;
  /** Future: rows from customer_conversations table */
  threads?: Array<{
    id: string;
    businessName: string;
    previewText?: string;
    updatedAt: string;
    messages: ConversationMessage[];
  }>;
}): CustomerConversation[] {
  const readMap = input.readMap ?? {};
  const threads = input.threads ?? [];

  const businessChats: CustomerConversation[] = threads.map((thread) => {
    const unreadCount = thread.messages.filter((m) => !m.read).length;
    const last = thread.messages[thread.messages.length - 1];
    return {
      id: thread.id,
      kind: "customer" as const,
      name: thread.businessName,
      avatarTone: "customer" as const,
      previewText: thread.previewText ?? last?.bodyText,
      updatedAt: thread.updatedAt,
      unreadCount,
      state: unreadCount > 0 ? "unread" : "read",
      messages: thread.messages,
    };
  });

  const merged = applyConversationReadState(businessChats, readMap);
  return merged.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
