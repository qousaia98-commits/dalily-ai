/**
 * SAD Chat domain — canonical public entry (Sprint 9.5 Phase 5).
 *
 * UI / Actions / Pages → @/domains/chat → chat engine → messaging bridge → realtime → DB
 *
 * `"use client"` modules must import from `@/domains/chat/client`.
 *
 * @see docs/architecture/chat.md
 */

export const CHAT_DOMAIN = {
  service: "chat",
  owns: ["threads", "messages", "qa_items", "conversation_typing", "user_presence"],
  impl: [
    "src/domains/chat",
    "src/lib/chat (chat engine)",
    "src/lib/chat/messaging-bridge (thin bridge)",
    "src/lib/messaging (legacy inbox helpers)",
    "src/lib/dalily-messages (legacy official thread)",
    "src/hooks/use-chat-realtime (canonical realtime)",
  ],
  status: "active",
  sprint: "9.5",
  featureFlag: "CHAT_ENGINE",
  realtimeFlag: "REALTIME_ENGINE",
  legacyAliasFlags: ["CHAT_AUTH_V2", "REALTIME_CHAT"],
} as const;

/* —— Domain auth / session (grant-gated full chat) —— */
export {
  canAccessFullChat,
  assertChatParticipants,
} from "@/domains/chat/authz";

export { ensureFullChatSessionForGrant } from "@/domains/chat/session";

/* —— Chat Engine —— */
export {
  getOrCreateConversationForRequest,
  listConversationsForViewer,
  setConversationFlags,
  insertTextMessage,
  searchMessages,
  softDeleteMessage,
  editMessage,
  setMessagePinned,
  CHAT_ATTACHMENTS_BUCKET,
  CHAT_MAX_ATTACHMENT_BYTES,
  attachmentKindForMime,
  isAllowedChatAttachment,
  uploadChatAttachment,
  createSignedAttachmentUrl,
  insertMessageAttachment,
  renameMessageAttachment,
  setAttachmentPinned,
  softDeleteMessageAttachment,
  prepareChatUploadSlot,
  markConversationReadServer,
  setTypingStatus,
  upsertPresence,
  markAllConversationsRead,
  trackChatAnalytics,
  type ConversationViewer,
} from "@/domains/chat/adapters/engine";

/* —— Messaging Bridge —— */
export { messagingBridge, chatModule } from "@/domains/chat/adapters/bridge";

/* —— Legacy messaging / Dalily —— */
export {
  loadConversationsForBusiness,
  loadConversationsForCustomer,
  loadConversationById,
  formatConversationListTime,
  resolveLatestMessageAt,
  isValidMessageTimestamp,
  formatMessageTime,
} from "@/domains/chat/adapters/messaging";

export {
  DALILY_CONVERSATION_ID,
  OFFICIAL_ACCOUNTS,
  getOfficialAccountByConversationId,
  listDalilyInboxMessages,
  markDalilyMessagesRead,
  parseDalilyCategory,
  parseDalilyRichContent,
} from "@/domains/chat/adapters/dalily";

/* —— Types —— */
export type {
  ChatMessageType,
  ChatDeliveryStatus,
  ChatConversationStatus,
  ChatScope,
  ChatAttachmentKind,
  ChatAttachment,
  ChatMessage,
  ChatParticipant,
  ChatConversation,
  DalilyMessageCategory,
  DalilyRichContent,
  OfficialAccountId,
  OfficialAccountProfile,
  ConversationTimeLabels,
} from "@/domains/chat/types";
