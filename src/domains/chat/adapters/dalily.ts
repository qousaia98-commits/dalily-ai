/**
 * Compatibility adapter — official Dalily system messages (legacy host: lib/dalily-messages).
 *
 * @see docs/architecture/chat.md
 */

export {
  DALILY_CONVERSATION_ID,
  OFFICIAL_ACCOUNTS,
  getOfficialAccountByConversationId,
  type OfficialAccountId,
  type OfficialAccountProfile,
} from "@/lib/dalily-messages/official-account";

export {
  listDalilyInboxMessages,
  markDalilyMessagesRead,
} from "@/lib/dalily-messages/inbox";

export {
  parseDalilyCategory,
  parseDalilyRichContent,
  isDalilyMessageCategory,
  type DalilyMessageCategory,
  type DalilyRichContent,
} from "@/lib/dalily-messages/message-meta";
