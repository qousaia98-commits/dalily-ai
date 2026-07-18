import { cookies } from "next/headers";
import { loadConversationsForCustomer } from "@/lib/messaging/queries";
import { MSG_READ_COOKIE, parseMsgReadCookie } from "@/lib/business/message-read-state";
import { applyConversationReadState } from "@/lib/business/conversations";

export async function loadCustomerConversations(userId: string | null) {
  if (!userId) {
    return { conversations: [] };
  }

  const jar = await cookies();
  const readMap = parseMsgReadCookie(jar.get(MSG_READ_COOKIE)?.value);
  const conversations = await loadConversationsForCustomer(userId);

  return {
    conversations: applyConversationReadState(conversations, readMap),
  };
}
