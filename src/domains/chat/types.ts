/**
 * Canonical chat types — Sprint 9.5 Phase 5.
 * Leaf re-exports only (safe for type-only client imports).
 */

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
} from "@/lib/chat/types";

export type {
  DalilyMessageCategory,
  DalilyRichContent,
} from "@/lib/dalily-messages/message-meta";

export type {
  OfficialAccountId,
  OfficialAccountProfile,
} from "@/lib/dalily-messages/official-account";

export type { ConversationTimeLabels } from "@/lib/messaging/format-conversation-time";
