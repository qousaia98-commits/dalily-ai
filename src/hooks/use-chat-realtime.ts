"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { setTypingAction, setPresenceAction } from "@/actions/chat.actions";
import { runServerAction } from "@/lib/next/server-action-recovery";

type Options = {
  conversationId: string;
  userId: string;
  peerUserId?: string | null;
  enabled?: boolean;
};

/**
 * Chat realtime: messages, typing broadcast, presence.
 * Presence/typing Server Actions are intentional; read-state is handled by
 * MarkConversationRead — do NOT re-call markChatRead on every message event
 * (that floods actions, OOMs the dev server, and invalidates action IDs).
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
  const [peerLastSeenAt, setPeerLastSeenAt] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef(() => {
    router.refresh();
  });
  refreshRef.current = () => {
    router.refresh();
  };

  useEffect(() => {
    if (!enabled || !conversationId || !userId) return;

    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const refresh = () => refreshRef.current();

    void runServerAction(() => setPresenceAction("online")).catch(() => undefined);

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
      // Initial presence fetch
      void (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("user_presence")
          .select("status, last_seen_at")
          .eq("user_id", peerUserId)
          .maybeSingle();
        if (data?.status) setPeerOnline(data.status === "online");
        if (data?.last_seen_at) setPeerLastSeenAt(String(data.last_seen_at));
      })();

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
            const row = payload.new as {
              status?: string;
              last_seen_at?: string;
            } | null;
            if (row?.status) setPeerOnline(row.status === "online");
            if (row?.last_seen_at) setPeerLastSeenAt(row.last_seen_at);
          },
        )
        .subscribe();
      channels.push(presenceChannel);
    }

    const onOffline = () => {
      void runServerAction(() => setPresenceAction("offline")).catch(() => undefined);
    };
    const onVisibility = () => {
      void runServerAction(() =>
        setPresenceAction(document.visibilityState === "visible" ? "online" : "offline"),
      ).catch(() => undefined);
    };
    window.addEventListener("beforeunload", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("beforeunload", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      void runServerAction(() => setTypingAction(conversationId, false)).catch(() => undefined);
      void runServerAction(() => setPresenceAction("offline")).catch(() => undefined);
      for (const ch of channels) void supabase.removeChannel(ch);
    };
  }, [conversationId, userId, peerUserId, enabled]);

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    void runServerAction(() => setTypingAction(conversationId, true)).catch(() => undefined);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void runServerAction(() => setTypingAction(conversationId, false)).catch(() => undefined);
    }, 4000);
  }, [conversationId]);

  return { typingNames, peerOnline, peerLastSeenAt, notifyTyping };
}
