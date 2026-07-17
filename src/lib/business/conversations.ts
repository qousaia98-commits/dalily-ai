import type { BusinessNotification } from "@/lib/business/notification-inbox";
import type { MsgReadMap } from "@/lib/business/message-read-state";

export type ConversationKind = "dalily" | "customer";
export type ConversationState = "unread" | "read" | "archived";

export type ConversationMessage = {
  id: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  bodyText?: string;
  createdAt: string;
  from: "dalily" | "customer" | "business";
  read: boolean;
};

export type BusinessConversation = {
  id: string;
  kind: ConversationKind;
  nameKey?: string;
  name?: string;
  phone?: string | null;
  avatarTone: "dalily" | "customer";
  previewKey?: string;
  previewText?: string;
  previewParams?: Record<string, string | number>;
  updatedAt: string;
  unreadCount: number;
  state: ConversationState;
  /** Future realtime typing indicator */
  isTyping?: boolean;
  messages: ConversationMessage[];
};

/**
 * Build WhatsApp-style conversations.
 * Dalily is a permanent system thread; customer chats are structured for future realtime.
 */
export function buildBusinessConversations(input: {
  notifications: BusinessNotification[];
  readMap?: MsgReadMap;
}): BusinessConversation[] {
  const readMap = input.readMap ?? {};
  const dalilyReadAt = readMap.dalily ? new Date(readMap.dalily).getTime() : 0;

  const dalilyMessages: ConversationMessage[] = input.notifications
    .filter((n) => n.source === "dalily" || n.source === "admin")
    .map((n) => {
      const created = new Date(n.createdAt).getTime();
      const markedRead = dalilyReadAt > 0 && created <= dalilyReadAt;
      return {
        id: n.id,
        bodyKey: n.bodyKey,
        bodyParams: n.bodyParams,
        createdAt: n.createdAt,
        from: "dalily" as const,
        read: markedRead || !n.unread,
      };
    });

  if (dalilyMessages.length === 0) {
    dalilyMessages.push({
      id: "dalily_welcome",
      bodyKey: "dalilyWelcome.body",
      createdAt: new Date(0).toISOString(),
      from: "dalily",
      read: true,
    });
  }

  dalilyMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // If user opened the thread, treat everything up to lastRead as read
  if (dalilyReadAt > 0) {
    for (const msg of dalilyMessages) {
      if (new Date(msg.createdAt).getTime() <= dalilyReadAt) msg.read = true;
    }
  }

  const last = dalilyMessages[dalilyMessages.length - 1];
  const unreadCount = dalilyMessages.filter((m) => !m.read).length;

  const dalily: BusinessConversation = {
    id: "dalily",
    kind: "dalily",
    nameKey: "dalilyName",
    avatarTone: "dalily",
    previewKey: last.bodyKey,
    previewParams: last.bodyParams,
    updatedAt: last.createdAt,
    unreadCount,
    state: unreadCount > 0 ? "unread" : "read",
    messages: dalilyMessages,
  };

  return [dalily].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function applyConversationReadState(
  conversations: BusinessConversation[],
  readMap: MsgReadMap,
): BusinessConversation[] {
  return conversations.map((c) => {
    const lastReadAt = readMap[c.id];
    if (!lastReadAt) return c;
    const threshold = new Date(lastReadAt).getTime();
    const messages = c.messages.map((m) => ({
      ...m,
      read: new Date(m.createdAt).getTime() <= threshold ? true : m.read,
    }));
    const unreadCount = messages.filter((m) => !m.read).length;
    return {
      ...c,
      messages,
      unreadCount,
      state: unreadCount > 0 ? "unread" : "read",
    };
  });
}

export function countUnreadConversations(items: BusinessConversation[]): number {
  return items.reduce((sum, c) => sum + c.unreadCount, 0);
}

export function findConversation(
  items: BusinessConversation[],
  id: string,
): BusinessConversation | null {
  return items.find((c) => c.id === id) ?? null;
}

export function filterConversations(
  items: BusinessConversation[],
  query: string,
  resolveName: (c: BusinessConversation) => string,
): BusinessConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((c) => {
    const name = resolveName(c).toLowerCase();
    const phone = (c.phone ?? "").toLowerCase();
    const preview = (c.previewText ?? "").toLowerCase();
    return name.includes(q) || phone.includes(q) || preview.includes(q) || c.id.includes(q);
  });
}
