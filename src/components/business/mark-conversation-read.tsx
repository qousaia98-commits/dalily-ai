"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { markConversationReadAction } from "@/actions/messaging.actions";

/**
 * Marks a conversation as read when the thread is opened.
 * Updates cookie + soft-refreshes layout badges without a hard reload.
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
    if (unreadCount <= 0) return;
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
