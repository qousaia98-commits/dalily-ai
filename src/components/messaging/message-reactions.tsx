"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleReactionAction } from "@/actions/chat-communication.actions";
import { useRouter } from "@/lib/i18n/navigation";
import type { MessageReactionSummary } from "@/domains/chat/communication";
import { cn } from "@/lib/utils";

const QUICK = ["👍", "❤️", "😂", "🙏", "👏"] as const;

export function MessageReactions({
  messageId,
  conversationId,
  reactions,
}: {
  messageId: string;
  conversationId: string;
  reactions: MessageReactionSummary[];
}) {
  const t = useTranslations("messaging.reactions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (emoji: string) => {
    startTransition(async () => {
      await toggleReactionAction({ messageId, conversationId, emoji });
      router.refresh();
    });
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label={t("aria")}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={pending}
          aria-pressed={r.reactedByMe}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors",
            r.reactedByMe
              ? "border-[var(--dalily-gold)]/50 bg-[var(--dalily-gold)]/15"
              : "border-border bg-background hover:bg-muted",
          )}
          onClick={() => toggle(r.emoji)}
        >
          <span aria-hidden>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <div className="flex gap-0.5 opacity-70">
        {QUICK.filter((e) => !reactions.some((r) => r.emoji === e)).map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={pending}
            className="rounded-full px-1 text-[11px] hover:bg-muted"
            aria-label={t("add", { emoji })}
            onClick={() => toggle(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
