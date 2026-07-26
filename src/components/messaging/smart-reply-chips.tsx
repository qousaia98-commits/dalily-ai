"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  acceptChatReplySuggestionAction,
  suggestChatRepliesAction,
} from "@/actions/chat-assistant.actions";
import type { ChatReplySuggestion } from "@/lib/ai/chat/types";

type Props = {
  conversationId: string;
  enabled?: boolean;
  onPick: (text: string) => void;
};

export function SmartReplyChips({ conversationId, enabled = true, onPick }: Props) {
  const t = useTranslations("messaging.aiAssistant");
  const [items, setItems] = useState<ChatReplySuggestion[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled || !conversationId) return;
    startTransition(async () => {
      const result = await suggestChatRepliesAction(conversationId);
      if (result.success) setItems(result.suggestions);
    });
  }, [conversationId, enabled]);

  if (!enabled || !items.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-4 py-2">
      <span className="w-full text-[10px] font-medium uppercase text-muted-foreground">
        {t("repliesTitle")} · {t("aiLabel")}
      </span>
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={pending}
          className="max-w-full rounded-full border border-border bg-card px-3 py-1 text-start text-[11px] text-foreground hover:bg-muted"
          onClick={() => {
            onPick(s.text);
            void acceptChatReplySuggestionAction({
              conversationId,
              edited: false,
            });
          }}
        >
          {s.text}
        </button>
      ))}
    </div>
  );
}
