"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { markConversationReadAction } from "@/actions/messaging.actions";
import { DALILY_CONVERSATION_ID } from "@/domains/chat/client";
import { runServerAction } from "@/lib/next/server-action-recovery";

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
      try {
        const result = await runServerAction(() =>
          markConversationReadAction(conversationId, lastMessageAt),
        );
        if (result.success) {
          router.refresh();
        }
      } catch {
        // skew → full reload via runServerAction
      }
    })();
  }, [conversationId, lastMessageAt, unreadCount, router]);

  return null;
}
