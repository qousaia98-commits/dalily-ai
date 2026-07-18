"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { sendMessageAction } from "@/actions/service-request.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const t = useTranslations("messaging.composer");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    setError(null);
    startTransition(async () => {
      const result = await sendMessageAction(conversationId, text);
      if (result.success) {
        setBody("");
        router.refresh();
      } else {
        setError(result.error ?? "send_failed");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="border-t border-border px-4 py-3">
      <div className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder")}
          rows={2}
          maxLength={4000}
          className="min-h-[2.75rem] flex-1 resize-none rounded-2xl"
          aria-label={t("placeholder")}
        />
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0 rounded-2xl"
          disabled={pending || !body.trim()}
          aria-label={t("send")}
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {t("error")}
        </p>
      ) : null}
    </form>
  );
}
