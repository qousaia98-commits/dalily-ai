/**
 * Chat Engine adapter — runtime: src/lib/chat.
 */

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
} from "@/lib/chat";
