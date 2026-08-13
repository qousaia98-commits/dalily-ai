/**
 * Client-safe Chat public surface.
 * Use from `"use client"` modules instead of `@/domains/chat`.
 *
 * Does not re-export server inbox helpers (listDalilyInboxMessages, etc.).
 */

export {
  formatConversationListTime,
  resolveLatestMessageAt,
  isValidMessageTimestamp,
  formatMessageTime,
  type ConversationTimeLabels,
} from "@/lib/messaging/format-conversation-time";

export {
  DALILY_CONVERSATION_ID,
  OFFICIAL_ACCOUNTS,
  getOfficialAccountByConversationId,
  type OfficialAccountId,
  type OfficialAccountProfile,
} from "@/lib/dalily-messages/official-account";

export {
  parseDalilyCategory,
  parseDalilyRichContent,
  type DalilyMessageCategory,
  type DalilyRichContent,
} from "@/lib/dalily-messages/message-meta";

export type {
  ChatMessage,
  ChatConversation,
  ChatAttachment,
  ChatScope,
} from "@/domains/chat/types";

export { useChatRealtime } from "@/hooks/use-chat-realtime";
