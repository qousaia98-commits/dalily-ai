"use client";

import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { TypingIndicator } from "@/components/messaging/typing-indicator";
import { MessageComposer } from "@/components/messaging/message-composer";

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
  const { typingNames, peerOnline, notifyTyping } = useChatRealtime({
    conversationId,
    userId,
    peerUserId,
    enabled: chatOpen,
  });

  if (!chatOpen) {
    return (
      <div className="border-t border-border px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">{lockedLabel}</p>
      </div>
    );
  }

  return (
    <div>
      {peerOnline != null ? (
        <p className="sr-only" aria-live="polite">
          {peerOnline ? "online" : "offline"}
        </p>
      ) : null}
      <TypingIndicator names={typingNames} />
      <MessageComposer conversationId={conversationId} onTyping={notifyTyping} />
    </div>
  );
}
