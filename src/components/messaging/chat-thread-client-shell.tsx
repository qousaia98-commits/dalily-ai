"use client";

import { useEffect, useState } from "react";
import { useChatRealtime } from "@/domains/chat/client";
import { TypingIndicator } from "@/components/messaging/typing-indicator";
import { MessageComposer } from "@/components/messaging/message-composer";
import { SmartReplyChips } from "@/components/messaging/smart-reply-chips";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isAiChatAssistantEnabledClient } from "@/lib/config/feature-flags-client";
import type { ChatReplyTarget } from "@/components/messaging/chat-composer-events";

export {
  requestChatReply,
  requestChatDraft,
} from "@/components/messaging/chat-composer-events";

type Props = {
  conversationId: string;
  userId: string;
  peerUserId?: string | null;
  chatOpen: boolean;
  lockedLabel: string;
};

/** Client shell for composer + typing + presence subscriptions. */
export function ChatThreadClientShell({
  conversationId,
  userId,
  peerUserId,
  chatOpen,
  lockedLabel,
}: Props) {
  const t = useTranslations("messaging.presence");
  const { typingNames, peerOnline, peerLastSeenAt, notifyTyping } =
    useChatRealtime({
      conversationId,
      userId,
      peerUserId,
      enabled: chatOpen,
    });
  const [reply, setReply] = useState<ChatReplyTarget | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const aiEnabled = isAiChatAssistantEnabledClient();

  useEffect(() => {
    function onReply(e: Event) {
      const detail = (e as CustomEvent<ChatReplyTarget>).detail;
      if (detail?.messageId) setReply(detail);
    }
    function onDraft(e: Event) {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (detail?.text) setDraft(detail.text);
    }
    window.addEventListener("dalily-chat-reply", onReply);
    window.addEventListener("dalily-chat-draft", onDraft);
    return () => {
      window.removeEventListener("dalily-chat-reply", onReply);
      window.removeEventListener("dalily-chat-draft", onDraft);
    };
  }, []);

  if (!chatOpen) {
    return (
      <div className="border-t border-border px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">{lockedLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-1.5 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            peerOnline ? "text-emerald-600 dark:text-emerald-400" : "",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              peerOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
          />
          {peerOnline
            ? t("online")
            : peerLastSeenAt
              ? t("lastSeen", {
                  time: new Date(peerLastSeenAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })
              : t("offline")}
        </span>
        <TypingIndicator names={typingNames} />
      </div>
      <SmartReplyChips
        conversationId={conversationId}
        enabled={aiEnabled}
        onPick={(text) => setDraft(text)}
      />
      <MessageComposer
        conversationId={conversationId}
        onTyping={notifyTyping}
        replyTo={reply}
        onClearReply={() => setReply(null)}
        draftText={draft}
        onDraftConsumed={() => setDraft(null)}
      />
    </div>
  );
}
