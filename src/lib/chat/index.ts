/**
 * Chat Engine barrel — INTERNAL runtime (conversations, messages, attachments, presence).
 *
 * External consumers MUST import via `@/domains/chat`.
 *
 * @see docs/architecture/chat.md
 */

export type * from "@/lib/chat/types";

export {
  getOrCreateConversationForRequest,
  listConversationsForViewer,
  setConversationFlags,
  type ConversationViewer,
} from "@/lib/chat/conversation-service";

export {
  insertTextMessage,
  searchMessages,
  softDeleteMessage,
  editMessage,
  setMessagePinned,
} from "@/lib/chat/message-service";

export {
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
} from "@/lib/chat/attachment-service";

export {
  markConversationReadServer,
  setTypingStatus,
} from "@/lib/chat/notification-service";

export { upsertPresence } from "@/lib/chat/presence-service";

export { markAllConversationsRead } from "@/lib/chat/scoped-conversations";

export { trackChatAnalytics } from "@/lib/chat/analytics";
