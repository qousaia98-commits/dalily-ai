"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { translateChatMessageAction } from "@/actions/chat-assistant.actions";
import type { ChatAiLanguage } from "@/lib/ai/chat/types";
import { cn } from "@/lib/utils";

type Props = {
  conversationId: string;
  messageId: string;
  originalText: string;
  enabled?: boolean;
  className?: string;
};

export function MessageTranslateToggle({
  conversationId,
  messageId,
  originalText,
  enabled = true,
  className,
}: Props) {
  const t = useTranslations("messaging.aiAssistant");
  const [pending, startTransition] = useTransition();
  const [showTranslated, setShowTranslated] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [target, setTarget] = useState<ChatAiLanguage>("en");

  if (!enabled || !originalText.trim()) return null;

  function run(lang: ChatAiLanguage) {
    setTarget(lang);
    startTransition(async () => {
      const result = await translateChatMessageAction({
        conversationId,
        messageId,
        text: originalText,
        targetLang: lang,
      });
      if (result.success && result.result) {
        setTranslated(result.result.translatedText);
        setShowTranslated(true);
      }
    });
  }

  return (
    <div className={cn("mt-1 space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-1">
        <Languages className="size-3 opacity-60" />
        {(["en", "ar", "de"] as ChatAiLanguage[]).map((lang) => (
          <button
            key={lang}
            type="button"
            disabled={pending}
            className="rounded px-1.5 py-0.5 text-[10px] uppercase opacity-70 hover:bg-black/10 hover:opacity-100"
            onClick={() => run(lang)}
          >
            {lang}
          </button>
        ))}
        {translated ? (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] opacity-70 hover:opacity-100"
            onClick={() => setShowTranslated((v) => !v)}
          >
            {showTranslated ? t("viewOriginal") : t("viewTranslated")}
          </button>
        ) : null}
      </div>
      {showTranslated && translated ? (
        <p className="rounded-lg bg-black/5 px-2 py-1 text-[11px] opacity-90">
          <span className="me-1 text-[9px] uppercase opacity-60">
            {t("aiLabel")} · {target}
          </span>
          {translated}
        </p>
      ) : null}
    </div>
  );
}
