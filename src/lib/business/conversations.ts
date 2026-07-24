import type { BusinessNotification } from "@/lib/business/notification-inbox";
import type { MsgReadMap } from "@/lib/business/message-read-state";
import { resolveLatestMessageAt } from "@/lib/messaging/format-conversation-time";
import {
  getOfficialAccountByConversationId,
  OFFICIAL_ACCOUNTS,
} from "@/lib/dalily-messages/official-account";
import {
  parseDalilyCategory,
  parseDalilyRichContent,
  type DalilyMessageCategory,
  type DalilyRichContent,
} from "@/lib/dalily-messages/message-meta";

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
  deliveryStatus?: "sent" | "delivered" | "read";
  messageType?: "text" | "image" | "document" | "location" | "voice" | "system" | "video";
  locationLat?: number | null;
  locationLng?: number | null;
  locationLabel?: string | null;
  /** Official channel category badge (future-ready; absent on legacy rows). */
  category?: DalilyMessageCategory | null;
  /** Optional rich layout for official messages. */
  rich?: DalilyRichContent | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    kind: string;
    signedUrl?: string | null;
  }>;
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
  pinned?: boolean;
  archived?: boolean;
  /** Official verified system account (Dalily). */
  official?: boolean;
  verified?: boolean;
  peerUserId?: string | null;
  peerOnline?: boolean | null;
  messages: ConversationMessage[];
  serviceRequestId?: string | null;
};

/**
 * Build WhatsApp-style conversations.
 * Dalily is a permanent official system thread; customer chats are structured for future realtime.
 */
export function buildBusinessConversations(input: {
  notifications: BusinessNotification[];
  readMap?: MsgReadMap;
}): BusinessConversation[] {
  const readMap = input.readMap ?? {};
  const dalilyReadAt = readMap.dalily ? new Date(readMap.dalily).getTime() : 0;
  const account = OFFICIAL_ACCOUNTS.dalily;

  const dalilyMessages: ConversationMessage[] = input.notifications
    .filter((n) => n.source === "dalily" || n.source === "admin")
    .map((n) => {
      const created = new Date(n.createdAt).getTime();
      const markedRead = dalilyReadAt > 0 && created <= dalilyReadAt;
      return {
        id: n.id,
        bodyKey: n.bodyKey,
        bodyParams: n.bodyParams,
        bodyText: n.bodyText,
        createdAt: n.createdAt,
        from: "dalily" as const,
        read: markedRead || !n.unread,
        isSystem: true,
        messageType: "system" as const,
        category: parseDalilyCategory(n.bodyParams),
        rich: parseDalilyRichContent(n.bodyParams),
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
      category: "announcement",
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
  const previewLine = last.bodyText
    ? last.bodyText.split("\n").map((l) => l.trim()).filter(Boolean)[0]
    : undefined;

  const dalily: BusinessConversation = {
    id: account.conversationId,
    kind: "dalily",
    nameKey: account.nameKey,
    avatarTone: "dalily",
    previewKey: previewLine ? undefined : last.bodyKey,
    previewText: previewLine,
    previewParams: last.bodyParams,
    updatedAt: resolveLatestMessageAt(dalilyMessages),
    unreadCount,
    state: unreadCount > 0 ? "unread" : "read",
    pinned: true,
    official: true,
    verified: true,
    messages: dalilyMessages,
  };

  return [dalily].sort(compareConversationsByLatestMessage);
}

/** Sort with official Dalily pinned near the top, then by latest message. */
export function compareConversationsByLatestMessage(
  a: BusinessConversation,
  b: BusinessConversation,
) {
  const aOfficial = a.official || a.kind === "dalily" ? 1 : 0;
  const bOfficial = b.official || b.kind === "dalily" ? 1 : 0;
  if (aOfficial !== bOfficial) return bOfficial - aOfficial;

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
    const messageHit = c.messages.some((m) => (m.bodyText ?? "").toLowerCase().includes(q));
    const account = getOfficialAccountByConversationId(c.id);
    const aliasHit = Boolean(
      account?.searchAliases.some(
        (alias) => alias.toLowerCase().includes(q) || q.includes(alias.toLowerCase()),
      ),
    );
    const officialHit =
      c.kind === "dalily" &&
      (q.includes("official") ||
        q.includes("system") ||
        q.includes("dalily") ||
        q.includes("دليلي") ||
        aliasHit);

    return (
      name.includes(q) ||
      phone.includes(q) ||
      preview.includes(q) ||
      messageHit ||
      c.id.includes(q) ||
      aliasHit ||
      officialHit
    );
  });
}
