import type { BusinessNotification } from "@/lib/business/notification-inbox";
import type { MsgReadMap } from "@/lib/business/message-read-state";
import { resolveLatestMessageAt } from "@/lib/messaging/format-conversation-time";

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
  isSystem?: boolean;
  eventType?: string | null;
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
  /** ISO timestamp of the newest real message; null when the thread has no messages yet. */
  updatedAt: string | null;
  unreadCount: number;
  state: ConversationState;
  /** Future realtime typing indicator */
  isTyping?: boolean;
  messages: ConversationMessage[];
  serviceRequestId?: string | null;
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
    // Placeholder copy only — never use Unix epoch as a display timestamp.
    dalilyMessages.push({
      id: "dalily_welcome",
      bodyKey: "dalilyWelcome.body",
      createdAt: "",
      from: "dalily",
      read: true,
    });
  }

  dalilyMessages.sort((a, b) => {
    const aMs = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bMs = b.createdAt ? Date.parse(b.createdAt) : 0;
    const aSafe = Number.isFinite(aMs) ? aMs : 0;
    const bSafe = Number.isFinite(bMs) ? bMs : 0;
    return aSafe - bSafe;
  });

  if (dalilyReadAt > 0) {
    for (const msg of dalilyMessages) {
      const created = msg.createdAt ? Date.parse(msg.createdAt) : NaN;
      if (Number.isFinite(created) && created <= dalilyReadAt) msg.read = true;
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
    updatedAt: resolveLatestMessageAt(dalilyMessages),
    unreadCount,
    state: unreadCount > 0 ? "unread" : "read",
    messages: dalilyMessages,
  };

  return [dalily].sort(compareConversationsByLatestMessage);
}

export function compareConversationsByLatestMessage(
  a: BusinessConversation,
  b: BusinessConversation,
) {
  const aMs = a.updatedAt ? Date.parse(a.updatedAt) : 0;
  const bMs = b.updatedAt ? Date.parse(b.updatedAt) : 0;
  return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
}

export function applyConversationReadState(
  conversations: BusinessConversation[],
  readMap: MsgReadMap,
): BusinessConversation[] {
  return conversations.map((c) => {
    const lastReadAt = readMap[c.id];
    const threshold = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    const messages = c.messages.map((m) => {
      if (m.read) return m;
      const created = m.createdAt ? Date.parse(m.createdAt) : NaN;
      if (threshold > 0 && Number.isFinite(created) && created <= threshold) {
        return { ...m, read: true };
      }
      return m;
    });
    const unreadCount = messages.filter((m) => !m.read).length;
    return {
      ...c,
      messages,
      unreadCount,
      state: unreadCount > 0 ? "unread" : "read",
      updatedAt: resolveLatestMessageAt(messages),
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
