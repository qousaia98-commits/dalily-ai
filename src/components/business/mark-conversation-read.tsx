"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { markConversationReadAction } from "@/actions/messaging.actions";
import { DALILY_CONVERSATION_ID } from "@/lib/dalily-messages/official-account";

/**
 * Marks a conversation as read when the thread is opened.
 * Updates cookie + soft-refreshes layout badges without a hard reload.
 * Official Dalily always syncs marketplace notification read_at (even if the
 * cookie already cleared the unread badge).
 */
export function MarkConversationRead({
  conversationId,
  lastMessageAt,
  unreadCount,
}: {
  conversationId: string;
  lastMessageAt: string;
  unreadCount: number;
}) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    const isDalily = conversationId === DALILY_CONVERSATION_ID;
    if (!isDalily && unreadCount <= 0) return;
    ran.current = true;

    void (async () => {
      const result = await markConversationReadAction(conversationId, lastMessageAt);
      if (result.success) {
        router.refresh();
      }
    })();
  }, [conversationId, lastMessageAt, unreadCount, router]);

  return null;
}
