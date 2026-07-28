/**
 * Compatibility adapter — inbox / conversation list helpers (legacy host: lib/messaging).
 *
 * @see docs/architecture/chat.md
 */

export {
  loadConversationsForBusiness,
  loadConversationsForCustomer,
  loadConversationById,
} from "@/lib/messaging/queries";

export {
  formatConversationListTime,
  resolveLatestMessageAt,
  isValidMessageTimestamp,
  formatMessageTime,
  type ConversationTimeLabels,
} from "@/lib/messaging/format-conversation-time";
