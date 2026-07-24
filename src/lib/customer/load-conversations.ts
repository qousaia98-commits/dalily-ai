import { cache } from "react";
import { cookies } from "next/headers";
import { loadConversationsForCustomer } from "@/lib/messaging/queries";
import { MSG_READ_COOKIE, parseMsgReadCookie } from "@/lib/business/message-read-state";
import {
  applyConversationReadState,
  buildBusinessConversations,
  compareConversationsByLatestMessage,
} from "@/lib/business/conversations";
import { listDalilyInboxMessages } from "@/lib/dalily-messages/inbox";

export const loadCustomerConversations = cache(async function loadCustomerConversations(
  userId: string | null,
) {
  if (!userId) {
    return { conversations: [] };
  }

  const jar = await cookies();
  const readMap = parseMsgReadCookie(jar.get(MSG_READ_COOKIE)?.value);
  const [peerConversations, dalilyInbox] = await Promise.all([
    loadConversationsForCustomer(userId),
    listDalilyInboxMessages(userId),
  ]);

  const dalilyConversations = buildBusinessConversations({
    notifications: dalilyInbox,
    readMap,
  });

  const conversations = [
    ...applyConversationReadState(peerConversations, readMap),
    ...dalilyConversations,
  ].sort(compareConversationsByLatestMessage);

  return { conversations };
});
