"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { setTypingAction, setPresenceAction, markChatReadAction } from "@/actions/chat.actions";

type Options = {
  conversationId: string;
  userId: string;
  peerUserId?: string | null;
  enabled?: boolean;
};

/**
 * Chat realtime: messages, typing broadcast, presence, auto-reconnect via channel resubscribe.
 */
export function useChatRealtime({
  conversationId,
  userId,
  peerUserId,
  enabled = true,
}: Options) {
  const router = useRouter();
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [peerOnline, setPeerOnline] = useState<boolean | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !conversationId || !userId) return;

    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const refresh = () => router.refresh();

    void setPresenceAction("online");
    void markChatReadAction(conversationId);

    const msgChannel = supabase
      .channel(`chat-msg-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          refresh();
          void markChatReadAction(conversationId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_attachments",
          filter: `conversation_id=eq.${conversationId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_typing",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from("conversation_typing")
            .select("user_id, expires_at")
            .eq("conversation_id", conversationId)
            .gt("expires_at", new Date().toISOString());
          const ids = ((data ?? []) as Array<{ user_id: string }>)
            .map((r) => r.user_id)
            .filter((id) => id !== userId);
          if (!ids.length) {
            setTypingNames([]);
            return;
          }
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", ids);
          setTypingNames(
            ((profiles ?? []) as Array<{ user_id: string; display_name: string | null }>).map(
              (p) => p.display_name || "…",
            ),
          );
        },
      )
      .subscribe();

    channels.push(msgChannel);

    if (peerUserId) {
      const presenceChannel = supabase
        .channel(`chat-presence-${peerUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_presence",
            filter: `user_id=eq.${peerUserId}`,
          },
          (payload) => {
            const row = payload.new as { status?: string } | null;
            if (row?.status) setPeerOnline(row.status === "online");
          },
        )
        .subscribe();
      channels.push(presenceChannel);
    }

    const onOffline = () => {
      void setPresenceAction("offline");
    };
    window.addEventListener("beforeunload", onOffline);
    document.addEventListener("visibilitychange", () => {
      void setPresenceAction(document.visibilityState === "visible" ? "online" : "offline");
    });

    return () => {
      window.removeEventListener("beforeunload", onOffline);
      void setTypingAction(conversationId, false);
      void setPresenceAction("offline");
      for (const ch of channels) void supabase.removeChannel(ch);
    };
  }, [conversationId, userId, peerUserId, enabled, router]);

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    void setTypingAction(conversationId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void setTypingAction(conversationId, false);
    }, 4000);
  }, [conversationId]);

  return { typingNames, peerOnline, notifyTyping };
}
